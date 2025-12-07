"""
Authentication Service
======================
JWT authentication and password hashing
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..schemas.user import TokenData

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")


class AuthService:
    """Authentication service"""
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(user_id: int, email: str) -> str:
        """Create a JWT access token"""
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        to_encode = {
            "sub": str(user_id),
            "email": email,
            "exp": expire
        }
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    @staticmethod
    def decode_token(token: str) -> Optional[TokenData]:
        """Decode and validate a JWT token"""
        try:
            payload = jwt.decode(
                token, 
                settings.secret_key, 
                algorithms=[settings.algorithm]
            )
            user_id = int(payload.get("sub"))
            email = payload.get("email")
            if user_id is None or email is None:
                return None
            return TokenData(user_id=user_id, email=email)
        except JWTError:
            return None
    
    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
        """Get a user by email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        """Get a user by ID"""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    
    @staticmethod
    async def authenticate_user(
        db: AsyncSession, 
        email: str, 
        password: str
    ) -> Optional[User]:
        """Authenticate a user"""
        user = await AuthService.get_user_by_email(db, email)
        if not user:
            return None
        if not AuthService.verify_password(password, user.hashed_password):
            return None
        return user
    
    @staticmethod
    async def create_user(
        db: AsyncSession, 
        email: str, 
        password: str, 
        full_name: Optional[str] = None
    ) -> User:
        """Create a new user"""
        hashed_password = AuthService.hash_password(password)
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = AuthService.decode_token(token)
    if token_data is None:
        raise credentials_exception
    
    user = await AuthService.get_user_by_id(db, token_data.user_id)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    return user

