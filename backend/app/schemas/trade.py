"""
Trade Schemas
=============
Pydantic models for trade API
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from ..models.trade import TradeDirection, TradeStatus, AssetType


class TradeBase(BaseModel):
    """Base trade schema"""
    symbol: str = Field(..., min_length=1, max_length=50)
    direction: TradeDirection
    asset_type: AssetType = AssetType.STOCK
    entry_time: datetime
    entry_price: Decimal = Field(..., gt=0)
    quantity: Decimal = Field(..., gt=0)
    
    exit_time: Optional[datetime] = None
    exit_price: Optional[Decimal] = None
    commission: Decimal = Decimal("0")
    
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class TradeCreate(TradeBase):
    """Schema for creating a new trade"""
    account_id: int


class TradeUpdate(BaseModel):
    """Schema for updating a trade"""
    exit_time: Optional[datetime] = None
    exit_price: Optional[Decimal] = None
    commission: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    status: Optional[TradeStatus] = None


class TradeResponse(TradeBase):
    """Schema for trade response"""
    id: int
    account_id: int
    broker_trade_id: Optional[str] = None
    status: TradeStatus
    
    # Calculated fields
    pnl_gross: Optional[Decimal] = None
    pnl_net: Optional[Decimal] = None
    pnl_percent: Optional[float] = None
    r_multiple: Optional[float] = None
    duration_minutes: Optional[int] = None
    is_winner: Optional[bool] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


class TradeChartData(BaseModel):
    """Trade data formatted for chart display"""
    symbol: str
    entry_time: int  # Unix timestamp
    exit_time: Optional[int] = None
    entry_price: float
    exit_price: Optional[float] = None
    direction: str
    quantity: float
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None
    is_winner: Optional[bool] = None
    tags: List[str] = []
    markers: List[Dict[str, Any]] = []


class DailyPnL(BaseModel):
    """Daily P&L data"""
    date: date
    pnl: Decimal
    trades_count: int
    winners: int
    losers: int
    cumulative_pnl: Decimal


class HourlyStats(BaseModel):
    """Hourly performance statistics"""
    hour: int
    trades: int
    wins: int
    pnl: Decimal
    win_rate: Optional[float] = None


class TradeStats(BaseModel):
    """Trading statistics"""
    # Overview
    total_trades: int
    winning_trades: int
    losing_trades: int
    open_trades: int
    
    # P&L
    total_pnl: Decimal
    total_commission: Decimal
    gross_profit: Decimal
    gross_loss: Decimal
    
    # Ratios
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    avg_winner: Optional[Decimal] = None
    avg_loser: Optional[Decimal] = None
    largest_winner: Optional[Decimal] = None
    largest_loser: Optional[Decimal] = None
    
    # Time-based
    avg_trade_duration_minutes: Optional[float] = None
    best_trading_hour: Optional[int] = None
    worst_trading_hour: Optional[int] = None
    
    # By asset
    by_symbol: Dict[str, Dict[str, Any]] = {}
    
    # Time series
    daily_pnl: List[DailyPnL] = []
    hourly_stats: List[HourlyStats] = []
    
    # Streaks
    current_streak: int = 0
    best_streak: int = 0
    worst_streak: int = 0




