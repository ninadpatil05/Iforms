from fastapi import HTTPException, status
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from app.config.settings import settings
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

    def google_login(self, db: Session, credential: str) -> Token:
        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential.",
            )

        google_id = idinfo.get("sub")
        email = idinfo.get("email")
        email_verified = idinfo.get("email_verified", False)
        name = idinfo.get("name") or (email.split("@")[0] if email else "Google User")

        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential payload.",
            )

        if not email_verified:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google email is not verified.",
            )

        user = user_service.get_or_create_google_user(
            db,
            google_id=google_id,
            email=email,
            name=name,
        )

        access_token = create_access_token(subject=user.id)
        return Token(access_token=access_token, token_type="bearer")


auth_service = AuthService()
