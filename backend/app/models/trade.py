"""
Trade Model
===========
מודל עסקה במסד הנתונים
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String, DateTime, ForeignKey, Numeric, Text, 
    Enum as SQLEnum, JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from ..database import Base


class TradeDirection(str, enum.Enum):
    """כיוון העסקה"""
    LONG = "long"
    SHORT = "short"


class TradeStatus(str, enum.Enum):
    """סטטוס העסקה"""
    OPEN = "open"
    CLOSED = "closed"
    PARTIAL = "partial"


class AssetType(str, enum.Enum):
    """סוג הנכס"""
    STOCK = "stock"
    OPTION = "option"
    FUTURE = "future"
    FOREX = "forex"
    CRYPTO = "crypto"
    CFD = "cfd"
    OTHER = "other"


class Trade(Base):
    """Trade database model"""
    
    __tablename__ = "trades"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    
    # Trade ID from broker
    broker_trade_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Basic Info
    symbol: Mapped[str] = mapped_column(String(50), index=True)
    asset_type: Mapped[AssetType] = mapped_column(
        SQLEnum(AssetType),
        default=AssetType.STOCK
    )
    direction: Mapped[TradeDirection] = mapped_column(SQLEnum(TradeDirection))
    status: Mapped[TradeStatus] = mapped_column(
        SQLEnum(TradeStatus),
        default=TradeStatus.CLOSED
    )
    
    # Timing
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    exit_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Prices
    entry_price: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    exit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    
    # Position
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    commission: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    
    # Calculated P&L (stored for fast queries)
    pnl_gross: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    pnl_net: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    pnl_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    
    # Risk Management
    stop_loss: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    take_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 8), nullable=True)
    r_multiple: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    
    # Metadata
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array as string
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Raw data from broker
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
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
    
    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="trades")
    
    def __repr__(self):
        return f"<Trade {self.symbol} {self.direction.value} @ {self.entry_time}>"
    
    def calculate_pnl(self):
        """חשב P&L ועדכן שדות"""
        if self.exit_price is None:
            return
        
        if self.direction == TradeDirection.LONG:
            self.pnl_gross = (self.exit_price - self.entry_price) * self.quantity
        else:
            self.pnl_gross = (self.entry_price - self.exit_price) * self.quantity
        
        self.pnl_net = self.pnl_gross - self.commission
        
        investment = self.entry_price * self.quantity
        if investment > 0:
            self.pnl_percent = (self.pnl_gross / investment) * 100

