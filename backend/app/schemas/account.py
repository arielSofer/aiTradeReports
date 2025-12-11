"""
Account Schemas
===============
Pydantic models for account API
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class AccountBase(BaseModel):
    """Base account schema"""
    name: str = Field(..., min_length=1, max_length=100)
    broker: str = Field(..., min_length=1, max_length=50)
    account_number: Optional[str] = None
    currency: str = "USD"
    initial_balance: Optional[Decimal] = None
    is_demo: bool = False


class AccountCreate(AccountBase):
    """Schema for creating a new account"""
    pass


class AccountUpdate(BaseModel):
    """Schema for updating an account"""
    name: Optional[str] = None
    initial_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_demo: Optional[bool] = None


class AccountResponse(AccountBase):
    """Schema for account response"""
    id: int
    user_id: int
    is_active: bool
    current_balance: Optional[Decimal] = None
    created_at: datetime
    last_sync: Optional[datetime] = None
    
    # Statistics
    total_trades: Optional[int] = 0
    total_pnl: Optional[Decimal] = None
    win_rate: Optional[float] = None
    
    class Config:
        from_attributes = True




