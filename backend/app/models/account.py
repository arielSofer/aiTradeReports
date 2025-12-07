"""
Account Model
=============
מודל חשבון מסחר במסד הנתונים
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Account(Base):
    """Trading Account database model"""
    
    __tablename__ = "accounts"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    # Account Info
    name: Mapped[str] = mapped_column(String(100))
    broker: Mapped[str] = mapped_column(String(50))  # e.g., "interactive_brokers"
    account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    # Balance
    initial_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2), 
        nullable=True
    )
    current_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(18, 2),
        nullable=True
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # API credentials (encrypted)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_secret_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    last_sync: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="accounts")
    trades: Mapped[List["Trade"]] = relationship(
        "Trade",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Account {self.name} ({self.broker})>"

