from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import StressTest, TestResult, TestStatus
from app.models.user import User
from app.redis_client import get_test_progress
from app.schemas import (
    StressTestCreate,
    StressTestUpdate,
    StressTestResponse,
    StressTestListResponse,
    TestResultResponse,
    TestTimeline,
    TimelinePoint,
    TestSummary,
)
from app.services.engine import start_stress_test, cancel_stress_test

router = APIRouter(prefix="/api/tests", tags=["stress-tests"])


# --- Dashboard Summary ---
@router.get("/summary", response_model=TestSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id
    total = await db.scalar(
        select(func.count(StressTest.id)).where(StressTest.user_id == uid)
    )
    running = await db.scalar(
        select(func.count(StressTest.id)).where(
            StressTest.user_id == uid, StressTest.status == TestStatus.RUNNING
        )
    )
    completed = await db.scalar(
        select(func.count(StressTest.id)).where(
            StressTest.user_id == uid, StressTest.status == TestStatus.COMPLETED
        )
    )
    failed = await db.scalar(
        select(func.count(StressTest.id)).where(
            StressTest.user_id == uid, StressTest.status == TestStatus.FAILED
        )
    )
    avg_rps = await db.scalar(
        select(func.avg(StressTest.requests_per_second)).where(
            StressTest.user_id == uid, StressTest.status == TestStatus.COMPLETED
        )
    )
    avg_err = await db.scalar(
        select(func.avg(StressTest.error_rate)).where(
            StressTest.user_id == uid, StressTest.status == TestStatus.COMPLETED
        )
    )

    return TestSummary(
        total_tests=total or 0,
        running_tests=running or 0,
        completed_tests=completed or 0,
        failed_tests=failed or 0,
        avg_requests_per_second=round(avg_rps, 2) if avg_rps else None,
        avg_error_rate=round(avg_err, 2) if avg_err else None,
    )


# --- CRUD ---
@router.get("/", response_model=list[StressTestListResponse])
async def list_tests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(StressTest).where(StressTest.user_id == current_user.id).order_by(
        desc(StressTest.created_at)
    )
    if status:
        query = query.where(StressTest.status == status)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=StressTestResponse, status_code=201)
async def create_test(
    test_data: StressTestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = StressTest(**test_data.model_dump(), user_id=current_user.id)
    db.add(test)
    await db.commit()
    await db.refresh(test)
    return test


@router.get("/{test_id}", response_model=StressTestResponse)
async def get_test(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_owned_test(test_id, current_user.id, db)


@router.put("/{test_id}", response_model=StressTestResponse)
async def update_test(
    test_id: UUID,
    test_data: StressTestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = await _get_owned_test(test_id, current_user.id, db)
    if test.status == TestStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot update a running test")

    for field, value in test_data.model_dump(exclude_unset=True).items():
        setattr(test, field, value)

    await db.commit()
    await db.refresh(test)
    return test


@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = await _get_owned_test(test_id, current_user.id, db)
    if test.status == TestStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot delete a running test")

    await db.delete(test)
    await db.commit()


# --- Execution ---
@router.post("/{test_id}/run", response_model=StressTestResponse)
async def run_test(
    test_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = await _get_owned_test(test_id, current_user.id, db)
    if test.status == TestStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Test is already running")

    # Reset stats for re-run
    test.status = TestStatus.PENDING
    test.total_requests_sent = 0
    test.successful_requests = 0
    test.failed_requests = 0
    test.avg_response_time_ms = None
    test.min_response_time_ms = None
    test.max_response_time_ms = None
    test.median_response_time_ms = None
    test.p95_response_time_ms = None
    test.p99_response_time_ms = None
    test.requests_per_second = None
    test.error_rate = None
    test.status_code_distribution = None
    test.started_at = None
    test.completed_at = None
    await db.commit()

    # Delete old results
    old_results = await db.execute(
        select(TestResult).where(TestResult.stress_test_id == test_id)
    )
    for r in old_results.scalars().all():
        await db.delete(r)
    await db.commit()

    background_tasks.add_task(start_stress_test, test_id)

    await db.refresh(test)
    return test


@router.post("/{test_id}/cancel")
async def cancel_test(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_test(test_id, current_user.id, db)
    cancelled = await cancel_stress_test(test_id)
    if not cancelled:
        raise HTTPException(status_code=400, detail="Test is not running")
    return {"message": "Test cancellation requested"}


# --- Results ---
@router.get("/{test_id}/results", response_model=list[TestResultResponse])
async def get_test_results(
    test_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_test(test_id, current_user.id, db)
    result = await db.execute(
        select(TestResult)
        .where(TestResult.stress_test_id == test_id)
        .order_by(TestResult.request_number)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{test_id}/timeline", response_model=TestTimeline)
async def get_test_timeline(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_test(test_id, current_user.id, db)
    result = await db.execute(
        select(TestResult)
        .where(TestResult.stress_test_id == test_id)
        .order_by(TestResult.timestamp)
    )
    results = result.scalars().all()

    if not results:
        return TestTimeline(points=[], duration_seconds=0)

    start_time = results[0].timestamp
    points = [
        TimelinePoint(
            timestamp=round((r.timestamp - start_time).total_seconds(), 3),
            response_time_ms=r.response_time_ms,
            status_code=r.status_code,
            is_error=r.is_error,
            active_users=r.user_number,
        )
        for r in results
    ]
    duration = (results[-1].timestamp - start_time).total_seconds()
    return TestTimeline(points=points, duration_seconds=round(duration, 3))


@router.get("/{test_id}/progress")
async def get_test_progress_endpoint(
    test_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_test(test_id, current_user.id, db)
    progress = await get_test_progress(str(test_id))
    return progress or {"completed": 0, "total": 0, "errors": 0}


# --- Helpers ---
async def _get_owned_test(test_id: UUID, user_id, db: AsyncSession) -> StressTest:
    result = await db.execute(
        select(StressTest).where(StressTest.id == test_id, StressTest.user_id == user_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test
