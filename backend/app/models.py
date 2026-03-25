import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import EmailStr, field_validator
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# WorkLog Payment Domain — DB table models
# ---------------------------------------------------------------------------


class Freelancer(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, max_length=255)
    email: str = Field(unique=True, index=True, max_length=255)
    hourly_rate: Decimal = Field(decimal_places=2, max_digits=10)


class Task(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(index=True, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class Payment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    date_from: date
    date_to: date
    total_amt: Decimal = Field(decimal_places=2, max_digits=12)
    status: str = Field(default="confirmed", max_length=50)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class WorkLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    task_id: uuid.UUID = Field(foreign_key="task.id")
    freelancer_id: uuid.UUID = Field(foreign_key="freelancer.id")
    status: str = Field(default="pending", index=True, max_length=50)
    payment_id: uuid.UUID | None = Field(
        default=None, foreign_key="payment.id", nullable=True, index=True
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class TimeEntry(SQLModel, table=True):
    __tablename__ = "time_entry"  # type: ignore[assignment]

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    worklog_id: uuid.UUID = Field(foreign_key="worklog.id", index=True)
    description: str = Field(max_length=1000)
    hours: Decimal = Field(decimal_places=2, max_digits=6)
    entry_date: date = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# WorkLog Payment Domain — Pydantic response/request schemas
# ---------------------------------------------------------------------------


class FreelancerPublic(SQLModel):
    id: uuid.UUID
    name: str
    email: str
    hourly_rate: Decimal


class TaskPublic(SQLModel):
    id: uuid.UUID
    title: str
    description: str | None


class TimeEntryPublic(SQLModel):
    id: uuid.UUID
    worklog_id: uuid.UUID
    description: str
    hours: Decimal
    entry_date: date
    created_at: datetime


class WorkLogPublic(SQLModel):
    id: uuid.UUID
    task_id: uuid.UUID
    freelancer_id: uuid.UUID
    status: str
    payment_id: uuid.UUID | None
    created_at: datetime
    total_hrs: Decimal = Decimal("0")
    earned_amt: Decimal = Decimal("0")


class WorkLogDetail(WorkLogPublic):
    task: TaskPublic
    freelancer: FreelancerPublic
    entries: list[TimeEntryPublic]


class WorkLogsPublic(SQLModel):
    data: list[WorkLogPublic]
    count: int


class PaymentCreate(SQLModel):
    date_from: date
    date_to: date
    excluded_worklog_ids: list[uuid.UUID] = []

    @field_validator("date_from")
    @classmethod
    def v_date_from(cls, v: date) -> date:
        """date_from must be a valid calendar date."""
        return v

    @field_validator("date_to")
    @classmethod
    def v_date_to(cls, v: date) -> date:
        """date_to must be a valid calendar date; range checked at endpoint level."""
        return v

    @field_validator("excluded_worklog_ids")
    @classmethod
    def v_excl(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        """Deduplicate excluded worklog IDs."""
        return list(dict.fromkeys(v))


class PaymentPublic(SQLModel):
    id: uuid.UUID
    date_from: date
    date_to: date
    total_amt: Decimal
    status: str
    created_at: datetime


class PaymentDetail(PaymentPublic):
    worklogs: list[WorkLogPublic]


class PaymentsPublic(SQLModel):
    data: list[PaymentPublic]
    count: int


class PaymentPreview(SQLModel):
    date_from: date
    date_to: date
    total_amt: Decimal
    worklogs: list[WorkLogPublic]
