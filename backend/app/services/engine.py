import asyncio
import time
import uuid
from datetime import datetime
from typing import Optional

import aiohttp
import numpy as np
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import StressTest, TestResult, TestStatus, HttpMethod
from app.redis_client import (
    is_test_cancelled,
    set_test_cancelled,
    set_test_progress,
    clear_test_keys,
)

_PROGRESS_INTERVAL = 10


class StressTestEngine:
    def __init__(self, test_id: uuid.UUID):
        self.test_id = test_id
        self.results: list[dict] = []
        self._active_users = 0
        self._request_counter = 0
        self._lock = asyncio.Lock()

    async def _cancelled(self) -> bool:
        return await is_test_cancelled(str(self.test_id))

    async def _load_test_config(self, session: AsyncSession) -> Optional[StressTest]:
        result = await session.execute(
            select(StressTest).where(StressTest.id == self.test_id)
        )
        return result.scalar_one_or_none()

    async def _update_status(self, session: AsyncSession, status: TestStatus, **kwargs):
        await session.execute(
            update(StressTest)
            .where(StressTest.id == self.test_id)
            .values(status=status, **kwargs)
        )
        await session.commit()

    async def _make_request(
        self,
        http_session: aiohttp.ClientSession,
        config: StressTest,
        user_number: int,
    ) -> dict:
        async with self._lock:
            self._request_counter += 1
            request_number = self._request_counter

        method = config.http_method.value
        headers = dict(config.headers or {})
        if config.content_type:
            headers.setdefault("Content-Type", config.content_type)

        body = config.body if config.http_method not in (HttpMethod.GET, HttpMethod.HEAD) else None

        start_time = time.perf_counter()
        status_code = None
        response_size = None
        is_error = False
        error_message = None

        try:
            timeout = aiohttp.ClientTimeout(total=config.timeout_seconds)
            async with http_session.request(
                method=method,
                url=config.target_url,
                headers=headers,
                data=body,
                timeout=timeout,
                ssl=False,
            ) as response:
                data = await response.read()
                status_code = response.status
                response_size = len(data)
                if status_code >= 400:
                    is_error = True
                    error_message = f"HTTP {status_code}"
        except asyncio.TimeoutError:
            is_error = True
            error_message = "Request timed out"
        except aiohttp.ClientError as e:
            is_error = True
            error_message = str(e)[:500]
        except Exception as e:
            is_error = True
            error_message = f"Unexpected error: {str(e)[:500]}"

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return {
            "request_number": request_number,
            "user_number": user_number,
            "status_code": status_code,
            "response_time_ms": round(elapsed_ms, 2),
            "response_size_bytes": response_size,
            "is_error": is_error,
            "error_message": error_message,
            "timestamp": datetime.utcnow(),
        }

    async def _virtual_user(
        self,
        http_session: aiohttp.ClientSession,
        config: StressTest,
        user_number: int,
        requests_per_user: int,
        total_requests: int,
    ):
        self._active_users += 1
        try:
            for _ in range(requests_per_user):
                if await self._cancelled():
                    break

                result = await self._make_request(http_session, config, user_number)
                self.results.append(result)

                done = len(self.results)
                if done % _PROGRESS_INTERVAL == 0:
                    errors = sum(1 for r in self.results if r["is_error"])
                    await set_test_progress(str(self.test_id), done, total_requests, errors)

                if config.think_time_ms > 0:
                    await asyncio.sleep(config.think_time_ms / 1000)
        finally:
            self._active_users -= 1

    async def _compute_aggregates(self) -> dict:
        if not self.results:
            return {}

        response_times = [r["response_time_ms"] for r in self.results]
        errors = [r for r in self.results if r["is_error"]]
        success = [r for r in self.results if not r["is_error"]]
        rt_array = np.array(response_times)

        status_codes: dict[str, int] = {}
        for r in self.results:
            code = str(r["status_code"]) if r["status_code"] else "error"
            status_codes[code] = status_codes.get(code, 0) + 1

        if len(self.results) >= 2:
            timestamps = [r["timestamp"] for r in self.results]
            duration = (max(timestamps) - min(timestamps)).total_seconds()
            rps = len(self.results) / duration if duration > 0 else 0
        else:
            rps = 0

        return {
            "total_requests_sent": len(self.results),
            "successful_requests": len(success),
            "failed_requests": len(errors),
            "avg_response_time_ms": round(float(np.mean(rt_array)), 2),
            "min_response_time_ms": round(float(np.min(rt_array)), 2),
            "max_response_time_ms": round(float(np.max(rt_array)), 2),
            "median_response_time_ms": round(float(np.median(rt_array)), 2),
            "p95_response_time_ms": round(float(np.percentile(rt_array, 95)), 2),
            "p99_response_time_ms": round(float(np.percentile(rt_array, 99)), 2),
            "requests_per_second": round(rps, 2),
            "error_rate": round(len(errors) / len(self.results) * 100, 2),
            "status_code_distribution": status_codes,
        }

    async def _save_results(self, session: AsyncSession):
        batch = [
            TestResult(
                stress_test_id=self.test_id,
                request_number=r["request_number"],
                user_number=r["user_number"],
                status_code=r["status_code"],
                response_time_ms=r["response_time_ms"],
                response_size_bytes=r["response_size_bytes"],
                is_error=r["is_error"],
                error_message=r["error_message"],
                timestamp=r["timestamp"],
            )
            for r in self.results
        ]
        for i in range(0, len(batch), 500):
            session.add_all(batch[i:i + 500])
            await session.commit()

    async def run(self):
        async with async_session() as session:
            config = await self._load_test_config(session)
            if not config:
                return
            await self._update_status(session, TestStatus.RUNNING, started_at=datetime.utcnow())

        try:
            requests_per_user = config.total_requests // config.concurrent_users
            remainder = config.total_requests % config.concurrent_users

            connector = aiohttp.TCPConnector(
                limit=config.concurrent_users,
                limit_per_host=config.concurrent_users,
                force_close=False,
            )

            async with aiohttp.ClientSession(connector=connector) as http_session:
                tasks = []
                for user_idx in range(config.concurrent_users):
                    if await self._cancelled():
                        break

                    user_requests = requests_per_user + (1 if user_idx < remainder else 0)
                    if user_requests == 0:
                        continue

                    if config.ramp_up_seconds > 0:
                        delay = (config.ramp_up_seconds / config.concurrent_users) * user_idx
                        await asyncio.sleep(delay)

                    tasks.append(
                        asyncio.create_task(
                            self._virtual_user(
                                http_session, config, user_idx + 1,
                                user_requests, config.total_requests,
                            )
                        )
                    )

                await asyncio.gather(*tasks, return_exceptions=True)

            aggregates = await self._compute_aggregates()
            cancelled = await self._cancelled()

            async with async_session() as session:
                await self._save_results(session)
                await self._update_status(
                    session,
                    TestStatus.CANCELLED if cancelled else TestStatus.COMPLETED,
                    completed_at=datetime.utcnow(),
                    **aggregates,
                )

        except Exception:
            async with async_session() as session:
                await self._update_status(
                    session, TestStatus.FAILED, completed_at=datetime.utcnow()
                )
            raise
        finally:
            await clear_test_keys(str(self.test_id))


async def start_stress_test(test_id: uuid.UUID):
    engine = StressTestEngine(test_id)
    await engine.run()


async def cancel_stress_test(test_id: uuid.UUID) -> bool:
    async with async_session() as session:
        result = await session.execute(
            select(StressTest).where(
                StressTest.id == test_id, StressTest.status == TestStatus.RUNNING
            )
        )
        if not result.scalar_one_or_none():
            return False

    await set_test_cancelled(str(test_id))
    return True
