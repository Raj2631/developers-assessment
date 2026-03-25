"""WorkLog payment domain — business logic."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import (
    Freelancer,
    FreelancerPublic,
    Payment,
    PaymentCreate,
    PaymentDetail,
    PaymentPreview,
    PaymentPublic,
    Task,
    TaskPublic,
    TimeEntry,
    TimeEntryPublic,
    WorkLog,
    WorkLogDetail,
    WorkLogPublic,
    WorkLogsPublic,
)


class WorkLogService:
    @staticmethod
    def get_freelancers(session: Session) -> list[FreelancerPublic]:
        """Return all freelancers for filter dropdowns."""
        fls = session.exec(select(Freelancer)).all()
        return [FreelancerPublic.model_validate(f, from_attributes=True) for f in fls]

    @staticmethod
    def get_worklogs(
        session: Session,
        date_from: date | None,
        date_to: date | None,
    ) -> WorkLogsPublic:
        """Return all worklogs; optionally filter to those with entries in [date_from, date_to]."""
        if date_from and date_to:
            if date_to < date_from:
                raise HTTPException(status_code=400, detail="date_to must be >= date_from")
            # Step 1: find worklog_ids that have entries in the date range
            tes = session.exec(
                select(TimeEntry).where(
                    TimeEntry.entry_date >= date_from,
                    TimeEntry.entry_date <= date_to,
                )
            ).all()
            wl_ids = list({te.worklog_id for te in tes})
            if not wl_ids:
                return WorkLogsPublic(data=[], count=0)
            wls = session.exec(
                select(WorkLog).where(WorkLog.id.in_(wl_ids))
            ).all()
        else:
            wls = session.exec(select(WorkLog)).all()

        data = [WorkLogService._build_wl_public(session, wl) for wl in wls]
        return WorkLogsPublic(data=data, count=len(data))

    @staticmethod
    def get_worklog(session: Session, wl_id: uuid.UUID) -> WorkLogDetail:
        """Return a single worklog with its task, freelancer and time entries."""
        wl = session.get(WorkLog, wl_id)
        if not wl:
            raise HTTPException(status_code=404, detail="WorkLog not found")
        fl = session.get(Freelancer, wl.freelancer_id)
        task = session.get(Task, wl.task_id)
        tes = session.exec(
            select(TimeEntry).where(TimeEntry.worklog_id == wl.id)
        ).all()
        total_hrs = sum((te.hours for te in tes), Decimal("0"))
        earned_amt = total_hrs * fl.hourly_rate  # type: ignore[union-attr]
        return WorkLogDetail(
            id=wl.id,
            task_id=wl.task_id,
            freelancer_id=wl.freelancer_id,
            status=wl.status,
            payment_id=wl.payment_id,
            created_at=wl.created_at,
            total_hrs=total_hrs,
            earned_amt=earned_amt,
            task=TaskPublic.model_validate(task, from_attributes=True),
            freelancer=FreelancerPublic.model_validate(fl, from_attributes=True),
            entries=[TimeEntryPublic.model_validate(te, from_attributes=True) for te in tes],
        )

    @staticmethod
    def preview_payment(session: Session, body: PaymentCreate) -> PaymentPreview:
        """Compute eligible worklogs for a payment batch without writing to DB."""
        if body.date_to < body.date_from:
            raise HTTPException(status_code=400, detail="date_to must be >= date_from")
        wls = WorkLogService._eligible_wls(session, body.date_from, body.date_to, body.excluded_worklog_ids)
        wl_publics = [WorkLogService._build_wl_public(session, wl) for wl in wls]
        total_amt = sum((w.earned_amt for w in wl_publics), Decimal("0"))
        return PaymentPreview(
            date_from=body.date_from,
            date_to=body.date_to,
            total_amt=total_amt,
            worklogs=wl_publics,
        )

    @staticmethod
    def confirm_payment(session: Session, body: PaymentCreate) -> PaymentPublic:
        """Create a Payment record and mark included worklogs as paid."""
        if body.date_to < body.date_from:
            raise HTTPException(status_code=400, detail="date_to must be >= date_from")
        wls = WorkLogService._eligible_wls(session, body.date_from, body.date_to, body.excluded_worklog_ids)
        if not wls:
            raise HTTPException(status_code=400, detail="No eligible worklogs for this date range")
        wl_publics = [WorkLogService._build_wl_public(session, wl) for wl in wls]
        total_amt = sum((w.earned_amt for w in wl_publics), Decimal("0"))

        pay = Payment(
            date_from=body.date_from,
            date_to=body.date_to,
            total_amt=total_amt,
        )
        session.add(pay)
        session.commit()
        session.refresh(pay)

        for wl in wls:
            wl.status = "paid"
            wl.payment_id = pay.id
            session.add(wl)
            session.commit()

        return PaymentPublic.model_validate(pay, from_attributes=True)

    @staticmethod
    def get_payments(session: Session) -> Any:
        """Return all payment records."""
        pays = session.exec(select(Payment)).all()
        return {"data": [PaymentPublic.model_validate(p, from_attributes=True) for p in pays], "count": len(pays)}

    @staticmethod
    def get_payment(session: Session, pay_id: uuid.UUID) -> PaymentDetail:
        """Return a single payment with its associated worklogs."""
        pay = session.get(Payment, pay_id)
        if not pay:
            raise HTTPException(status_code=404, detail="Payment not found")
        wls = session.exec(
            select(WorkLog).where(WorkLog.payment_id == pay.id)
        ).all()
        wl_publics = [WorkLogService._build_wl_public(session, wl) for wl in wls]
        return PaymentDetail(
            id=pay.id,
            date_from=pay.date_from,
            date_to=pay.date_to,
            total_amt=pay.total_amt,
            status=pay.status,
            created_at=pay.created_at,
            worklogs=wl_publics,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_wl_public(session: Session, wl: WorkLog) -> WorkLogPublic:
        """Compute total_hrs and earned_amt for a single WorkLog row."""
        fl = session.get(Freelancer, wl.freelancer_id)
        tes = session.exec(
            select(TimeEntry).where(TimeEntry.worklog_id == wl.id)
        ).all()
        total_hrs = sum((te.hours for te in tes), Decimal("0"))
        earned_amt = total_hrs * fl.hourly_rate  # type: ignore[union-attr]
        return WorkLogPublic(
            id=wl.id,
            task_id=wl.task_id,
            freelancer_id=wl.freelancer_id,
            status=wl.status,
            payment_id=wl.payment_id,
            created_at=wl.created_at,
            total_hrs=total_hrs,
            earned_amt=earned_amt,
        )

    @staticmethod
    def _eligible_wls(
        session: Session,
        date_from: date,
        date_to: date,
        excl: list[uuid.UUID],
    ) -> list[WorkLog]:
        """Return pending worklogs that have entries in [date_from, date_to], minus excluded IDs."""
        tes = session.exec(
            select(TimeEntry).where(
                TimeEntry.entry_date >= date_from,
                TimeEntry.entry_date <= date_to,
            )
        ).all()
        wl_ids = {te.worklog_id for te in tes}
        if not wl_ids:
            return []
        wls = session.exec(
            select(WorkLog).where(
                WorkLog.id.in_(wl_ids),
                WorkLog.status == "pending",
            )
        ).all()
        excl_set = set(excl)
        return [wl for wl in wls if wl.id not in excl_set]
