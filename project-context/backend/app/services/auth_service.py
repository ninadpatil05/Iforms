from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import Token, UserCreate
from app.services.user_service import user_service
from app.utils.security import create_access_token


class AuthService:
    def signup(self, db: Session, user_in: UserCreate) -> User:
        return user_service.create_user(db, user_in)

    def login(self, db: Session, email: str, password: str) -> Token:
        user = user_service.authenticate(db, email=email, password=password)
        access_token = create_access_token(subject=user.id)
        return Token(access_token=access_token, token_type="bearer")


auth_service = AuthService()
