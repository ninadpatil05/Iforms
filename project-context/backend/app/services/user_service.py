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
        return user_repository.create(db, name=user_in.name, email=user_in.email, password_hash=hashed, role=user_in.role)

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


user_service = UserService()
