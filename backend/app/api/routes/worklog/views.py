"""WorkLog payment domain — API endpoints."""

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.api.routes.worklog.service import WorkLogService
from app.models import (
    FreelancerPublic,
    PaymentCreate,
    PaymentDetail,
    PaymentPreview,
    PaymentPublic,
    WorkLogDetail,
    WorkLogsPublic,
)

router = APIRouter(prefix="/worklog", tags=["worklog"])


@router.get("/freelancers", response_model=list[FreelancerPublic])
def list_freelancers(session: SessionDep, current_user: CurrentUser) -> Any:
    """Return all freelancers (used to populate filter dropdowns)."""
    return WorkLogService.get_freelancers(session)


@router.get("/payments", response_model=dict)
def list_payments(session: SessionDep, current_user: CurrentUser) -> Any:
    """Return all payment records."""
    return WorkLogService.get_payments(session)


@router.get("/payments/{pay_id}", response_model=PaymentDetail)
def get_payment(session: SessionDep, current_user: CurrentUser, pay_id: uuid.UUID) -> Any:
    """Return a single payment with its worklogs."""
    return WorkLogService.get_payment(session, pay_id)


@router.post("/payment/preview", response_model=PaymentPreview)
def preview_payment(session: SessionDep, current_user: CurrentUser, body: PaymentCreate) -> Any:
    """Preview eligible worklogs for a payment batch (no DB write)."""
    return WorkLogService.preview_payment(session, body)


@router.post("/payment/confirm", response_model=PaymentPublic, status_code=201)
def confirm_payment(session: SessionDep, current_user: CurrentUser, body: PaymentCreate) -> Any:
    """Create a payment and mark included worklogs as paid."""
    return WorkLogService.confirm_payment(session, body)


@router.get("/", response_model=WorkLogsPublic)
def list_worklogs(
    session: SessionDep,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Any:
    """Return all worklogs, optionally filtered by date range."""
    return WorkLogService.get_worklogs(session, date_from, date_to)


@router.get("/{wl_id}", response_model=WorkLogDetail)
def get_worklog(session: SessionDep, current_user: CurrentUser, wl_id: uuid.UUID) -> Any:
    """Return a single worklog with time entries and computed totals."""
    return WorkLogService.get_worklog(session, wl_id)
