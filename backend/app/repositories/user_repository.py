from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def get_by_id(self, db: Session, user_id: int) -> Optional[User]:
        statement = select(User).where(User.id == user_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        statement = select(User).where(User.email == email)
        return db.execute(statement).scalar_one_or_none()

    def get_by_google_id(self, db: Session, google_id: str) -> Optional[User]:
        statement = select(User).where(User.google_id == google_id)
        return db.execute(statement).scalar_one_or_none()

    def create(
        self,
        db: Session,
        name: str,
        email: str,
        password_hash: Optional[str] = None,
        role: str = "user",
        google_id: Optional[str] = None,
    ) -> User:
        db_obj = User(
            name=name,
            email=email,
            password_hash=password_hash,
            role=role,
            google_id=google_id,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


user_repository = UserRepository()
