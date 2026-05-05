import asyncio
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import StressTest, TestResult, TestStatus
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
async def get_summary(db: AsyncSession = Depends(get_db)):
    total = await db.scalar(select(func.count(StressTest.id)))
    running = await db.scalar(
        select(func.count(StressTest.id)).where(StressTest.status == TestStatus.RUNNING)
    )
    completed = await db.scalar(
        select(func.count(StressTest.id)).where(StressTest.status == TestStatus.COMPLETED)
    )
    failed = await db.scalar(
        select(func.count(StressTest.id)).where(StressTest.status == TestStatus.FAILED)
    )
    avg_rps = await db.scalar(
        select(func.avg(StressTest.requests_per_second)).where(
            StressTest.status == TestStatus.COMPLETED
        )
    )
    avg_err = await db.scalar(
        select(func.avg(StressTest.error_rate)).where(
            StressTest.status == TestStatus.COMPLETED
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
):
    query = select(StressTest).order_by(desc(StressTest.created_at))
    if status:
        query = query.where(StressTest.status == status)
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=StressTestResponse, status_code=201)
async def create_test(
    test_data: StressTestCreate,
    db: AsyncSession = Depends(get_db),
):
    test = StressTest(**test_data.model_dump())
    db.add(test)
    await db.commit()
    await db.refresh(test)
    return test


@router.get("/{test_id}", response_model=StressTestResponse)
async def get_test(test_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StressTest).where(StressTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.put("/{test_id}", response_model=StressTestResponse)
async def update_test(
    test_id: UUID,
    test_data: StressTestUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StressTest).where(StressTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    if test.status == TestStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Cannot update a running test")

    update_data = test_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(test, field, value)

    await db.commit()
    await db.refresh(test)
    return test


@router.delete("/{test_id}", status_code=204)
async def delete_test(test_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StressTest).where(StressTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
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
):
    result = await db.execute(select(StressTest).where(StressTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
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
    await db.refresh(test)

    # Delete old results
    old_results = await db.execute(
        select(TestResult).where(TestResult.stress_test_id == test_id)
    )
    for r in old_results.scalars().all():
        await db.delete(r)
    await db.commit()

    # Run test in background
    background_tasks.add_task(_run_test_wrapper, test_id)

    await db.refresh(test)
    return test


async def _run_test_wrapper(test_id: UUID):
    """Wrapper to run stress test in a new event loop context."""
    await start_stress_test(test_id)


@router.post("/{test_id}/cancel")
async def cancel_test(test_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StressTest).where(StressTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

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
):
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
):
    result = await db.execute(
        select(TestResult)
        .where(TestResult.stress_test_id == test_id)
        .order_by(TestResult.timestamp)
    )
    results = result.scalars().all()

    if not results:
        return TestTimeline(points=[], duration_seconds=0)

    start_time = results[0].timestamp
    points = []
    for r in results:
        elapsed = (r.timestamp - start_time).total_seconds()
        points.append(TimelinePoint(
            timestamp=round(elapsed, 3),
            response_time_ms=r.response_time_ms,
            status_code=r.status_code,
            is_error=r.is_error,
            active_users=r.user_number,
        ))

    duration = (results[-1].timestamp - start_time).total_seconds()
    return TestTimeline(points=points, duration_seconds=round(duration, 3))
