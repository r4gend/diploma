import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Text, JSON,
    ForeignKey, Enum as SQLEnum, Boolean
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class TestStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HttpMethod(str, enum.Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"


class StressTest(Base):
    __tablename__ = "stress_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Target configuration
    target_url = Column(String(2048), nullable=False)
    http_method = Column(SQLEnum(HttpMethod), default=HttpMethod.GET)
    headers = Column(JSON, nullable=True)  # Custom headers as JSON
    body = Column(Text, nullable=True)  # Request body
    content_type = Column(String(100), default="application/json")

    # Test parameters
    total_requests = Column(Integer, nullable=False, default=100)
    concurrent_users = Column(Integer, nullable=False, default=10)
    ramp_up_seconds = Column(Integer, default=0)  # Gradual ramp-up
    timeout_seconds = Column(Float, default=30.0)
    think_time_ms = Column(Integer, default=0)  # Delay between requests per user

    # Status & timing
    status = Column(SQLEnum(TestStatus), default=TestStatus.PENDING)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Aggregated results
    total_requests_sent = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, nullable=True)
    min_response_time_ms = Column(Float, nullable=True)
    max_response_time_ms = Column(Float, nullable=True)
    median_response_time_ms = Column(Float, nullable=True)
    p95_response_time_ms = Column(Float, nullable=True)
    p99_response_time_ms = Column(Float, nullable=True)
    requests_per_second = Column(Float, nullable=True)
    error_rate = Column(Float, nullable=True)

    # Status code distribution
    status_code_distribution = Column(JSON, nullable=True)

    # Owner
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="tests")

    # Relationships
    results = relationship("TestResult", back_populates="stress_test", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<StressTest(id={self.id}, name='{self.name}', status={self.status})>"


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stress_test_id = Column(UUID(as_uuid=True), ForeignKey("stress_tests.id"), nullable=False)

    # Per-request data
    request_number = Column(Integer, nullable=False)
    user_number = Column(Integer, nullable=False)  # Virtual user index
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=False)
    response_size_bytes = Column(Integer, nullable=True)
    is_error = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationship
    stress_test = relationship("StressTest", back_populates="results")

    def __repr__(self):
        return f"<TestResult(id={self.id}, status={self.status_code}, time={self.response_time_ms}ms)>"
