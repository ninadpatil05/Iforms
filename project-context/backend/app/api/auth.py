from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """Register a new user account."""
    return auth_service.signup(db=db, user_in=user_in)


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate user and return access token."""
    return auth_service.login(db=db, email=form_data.username, password=form_data.password)


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get profile information for the authenticated current user."""
    return current_user
