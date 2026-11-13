from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import user_repository
from app.schemas.user import UserCreate
from app.utils.security import hash_password, verify_password


class UserService:
    def create_user(self, db: Session, user_in: UserCreate) -> User:
        existing = user_repository.get_by_email(db, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )
        hashed = hash_password(user_in.password)
        return user_repository.create(db, name=user_in.name, email=user_in.email, password_hash=hashed, role="user")

    def authenticate(self, db: Session, email: str, password: str) -> User:
        user = user_repository.get_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    def get_user_by_id(self, db: Session, user_id: int) -> User:
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def get_or_create_google_user(self, db: Session, *, google_id: str, email: str, name: str) -> User:
        # 1. Check if user with this google_id already exists
        user = user_repository.get_by_google_id(db, google_id)
        if user:
            return user

        # 2. Check if user with this email already exists -> link google_id
        user_by_email = user_repository.get_by_email(db, email)
        if user_by_email:
            user_by_email.google_id = google_id
            db.commit()
            db.refresh(user_by_email)
            return user_by_email

        # 3. Create a new user with hardcoded role="user"
        return user_repository.create(
            db,
            name=name,
            email=email,
            password_hash=None,
            role="user",
            google_id=google_id,
        )


user_service = UserService()
