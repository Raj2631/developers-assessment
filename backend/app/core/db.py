from datetime import date
from decimal import Decimal

from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Freelancer, Task, TimeEntry, User, UserCreate, WorkLog

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

    # Seed worklog domain data — guarded so re-runs are safe
    existing_freelancer = session.exec(select(Freelancer)).first()
    if existing_freelancer:
        return

    # --- Freelancers ---
    alice = Freelancer(name="Alice Johnson", email="alice@example.com", hourly_rate=Decimal("75.00"))
    bob = Freelancer(name="Bob Smith", email="bob@example.com", hourly_rate=Decimal("90.00"))
    carol = Freelancer(name="Carol White", email="carol@example.com", hourly_rate=Decimal("60.00"))
    session.add(alice)
    session.add(bob)
    session.add(carol)
    session.commit()
    session.refresh(alice)
    session.refresh(bob)
    session.refresh(carol)

    # --- Tasks ---
    t_api = Task(title="API Integration", description="Integrate third-party REST APIs")
    t_ui = Task(title="UI Design", description="Design and implement frontend components")
    t_db = Task(title="Database Schema", description="Design and optimize database schema")
    t_cr = Task(title="Code Review", description="Review pull requests and provide feedback")
    session.add(t_api)
    session.add(t_ui)
    session.add(t_db)
    session.add(t_cr)
    session.commit()
    session.refresh(t_api)
    session.refresh(t_ui)
    session.refresh(t_db)
    session.refresh(t_cr)

    # --- WorkLogs + TimeEntries ---
    # Dates span Nov–Dec 2025 so date-range filtering is easy to demo
    seed_worklogs = [
        (alice, t_api, [
            ("OAuth2 provider setup", Decimal("2.00"), date(2025, 11, 3)),
            ("Webhook endpoint implementation", Decimal("3.00"), date(2025, 11, 10)),
            ("Error handling and retries", Decimal("1.50"), date(2025, 11, 17)),
        ]),
        (alice, t_cr, [
            ("Reviewed auth module PR", Decimal("1.00"), date(2025, 11, 20)),
            ("Reviewed API layer PR", Decimal("2.00"), date(2025, 11, 25)),
        ]),
        (bob, t_ui, [
            ("Dashboard layout and grid", Decimal("4.00"), date(2025, 11, 5)),
            ("Data table component", Decimal("2.00"), date(2025, 11, 12)),
            ("Mobile responsive pass", Decimal("3.00"), date(2025, 12, 2)),
        ]),
        (bob, t_db, [
            ("Schema design and ERD", Decimal("5.00"), date(2025, 11, 8)),
            ("Index optimisation", Decimal("3.00"), date(2025, 11, 22)),
        ]),
        (carol, t_api, [
            ("Payment gateway integration", Decimal("2.00"), date(2025, 11, 14)),
            ("Integration test suite", Decimal("2.00"), date(2025, 12, 1)),
        ]),
        (carol, t_ui, [
            ("Forms and validation components", Decimal("6.00"), date(2025, 11, 28)),
        ]),
    ]

    for freelancer, task, entries in seed_worklogs:
        wl = WorkLog(task_id=task.id, freelancer_id=freelancer.id)
        session.add(wl)
        session.commit()
        session.refresh(wl)
        for desc, hrs, entry_date in entries:
            te = TimeEntry(worklog_id=wl.id, description=desc, hours=hrs, date=entry_date)
            session.add(te)
            session.commit()
