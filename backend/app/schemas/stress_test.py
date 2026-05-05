from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum


# --- Enums ---
class HttpMethodEnum(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class TestStatusEnum(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# --- Create / Update ---
class StressTestCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    target_url: str = Field(..., min_length=1)
    http_method: HttpMethodEnum = HttpMethodEnum.GET
    headers: Optional[dict] = None
    body: Optional[str] = None
    content_type: str = "application/json"
    total_requests: int = Field(100, ge=1, le=100000)
    concurrent_users: int = Field(10, ge=1, le=1000)
    ramp_up_seconds: int = Field(0, ge=0, le=600)
    timeout_seconds: float = Field(30.0, ge=1.0, le=120.0)
    think_time_ms: int = Field(0, ge=0, le=10000)


class StressTestUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    target_url: Optional[str] = None
    http_method: Optional[HttpMethodEnum] = None
    headers: Optional[dict] = None
    body: Optional[str] = None
    content_type: Optional[str] = None
    total_requests: Optional[int] = Field(None, ge=1, le=100000)
    concurrent_users: Optional[int] = Field(None, ge=1, le=1000)
    ramp_up_seconds: Optional[int] = Field(None, ge=0, le=600)
    timeout_seconds: Optional[float] = Field(None, ge=1.0, le=120.0)
    think_time_ms: Optional[int] = Field(None, ge=0, le=10000)


# --- Response ---
class StressTestResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    target_url: str
    http_method: HttpMethodEnum
    headers: Optional[dict]
    body: Optional[str]
    content_type: str
    total_requests: int
    concurrent_users: int
    ramp_up_seconds: int
    timeout_seconds: float
    think_time_ms: int
    status: TestStatusEnum
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Aggregated results
    total_requests_sent: int
    successful_requests: int
    failed_requests: int
    avg_response_time_ms: Optional[float]
    min_response_time_ms: Optional[float]
    max_response_time_ms: Optional[float]
    median_response_time_ms: Optional[float]
    p95_response_time_ms: Optional[float]
    p99_response_time_ms: Optional[float]
    requests_per_second: Optional[float]
    error_rate: Optional[float]
    status_code_distribution: Optional[dict]

    class Config:
        from_attributes = True


class StressTestListResponse(BaseModel):
    id: UUID
    name: str
    target_url: str
    http_method: HttpMethodEnum
    total_requests: int
    concurrent_users: int
    status: TestStatusEnum
    created_at: datetime
    avg_response_time_ms: Optional[float]
    requests_per_second: Optional[float]
    error_rate: Optional[float]

    class Config:
        from_attributes = True


class TestResultResponse(BaseModel):
    id: UUID
    stress_test_id: UUID
    request_number: int
    user_number: int
    status_code: Optional[int]
    response_time_ms: float
    response_size_bytes: Optional[int]
    is_error: bool
    error_message: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Timeline data for charts ---
class TimelinePoint(BaseModel):
    timestamp: float  # Seconds since test start
    response_time_ms: float
    status_code: Optional[int]
    is_error: bool
    active_users: int


class TestTimeline(BaseModel):
    points: list[TimelinePoint]
    duration_seconds: float


class TestSummary(BaseModel):
    total_tests: int
    running_tests: int
    completed_tests: int
    failed_tests: int
    avg_requests_per_second: Optional[float]
    avg_error_rate: Optional[float]
