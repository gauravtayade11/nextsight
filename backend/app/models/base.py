import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


def generate_uuid() -> str:
    return str(uuid.uuid4())
