from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, GoogleAuthRequest
from app.services.auth_service import auth_service
from app.utils.rate_limit import check_rate_limit, get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(request: Request, user_in: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """Register a new user account."""
    client_ip = get_client_ip(request)
    check_rate_limit(
        key=f"auth_signup:{client_ip}",
        max_requests=5,
        window_seconds=60,
        detail="Too many signup attempts. Please wait a minute before trying again.",
    )
    return auth_service.signup(db=db, user_in=user_in)


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate user and return access token."""
    client_ip = get_client_ip(request)
    check_rate_limit(
        key=f"auth_login_ip:{client_ip}",
        max_requests=15,
        window_seconds=60,
        detail="Too many login attempts from this IP. Please wait a minute before trying again.",
    )
    check_rate_limit(
        key=f"auth_login_email:{form_data.username.lower().strip()}",
        max_requests=10,
        window_seconds=60,
        detail="Too many login attempts for this account. Please wait a minute before trying again.",
    )
    return auth_service.login(db=db, email=form_data.username, password=form_data.password)


@router.post("/google", response_model=Token, status_code=status.HTTP_200_OK)
def google_auth(request: Request, payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> Token:
    """Authenticate user with Google OAuth ID token and return access token."""
    client_ip = get_client_ip(request)
    check_rate_limit(
        key=f"auth_google_ip:{client_ip}",
        max_requests=15,
        window_seconds=60,
        detail="Too many authentication attempts. Please wait a minute before trying again.",
    )
    return auth_service.google_login(db=db, credential=payload.credential)


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get profile information for the authenticated current user."""
    return current_user
