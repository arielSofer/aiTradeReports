"""
Statistics Router
=================
Trading statistics and analytics endpoints
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.auth import get_current_user
from ..services.trade_service import TradeService
from ..models.user import User
from ..schemas.trade import TradeStats, DailyPnL

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("", response_model=TradeStats)
async def get_trading_statistics(
    account_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive trading statistics
    
    Returns:
    - Overall P&L and performance metrics
    - Win rate, profit factor, average win/loss
    - Daily P&L for equity curve
    - Hourly performance analysis
    - Statistics by symbol
    - Winning/losing streaks
    """
    stats = await TradeService.get_statistics(
        db,
        user_id=current_user.id,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return stats


@router.get("/daily-pnl", response_model=List[DailyPnL])
async def get_daily_pnl(
    account_id: Optional[int] = None,
    days: int = Query(30, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get daily P&L for the specified period
    
    Perfect for equity curve charts.
    """
    from datetime import timedelta
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    stats = await TradeService.get_statistics(
        db,
        user_id=current_user.id,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return stats.daily_pnl


@router.get("/summary")
async def get_quick_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get quick summary for dashboard header
    """
    stats = await TradeService.get_statistics(db, user_id=current_user.id)
    
    return {
        "total_trades": stats.total_trades,
        "total_pnl": float(stats.total_pnl),
        "win_rate": stats.win_rate,
        "profit_factor": stats.profit_factor,
        "open_trades": stats.open_trades,
        "today_pnl": float(stats.daily_pnl[-1].pnl) if stats.daily_pnl else 0,
        "current_streak": stats.current_streak
    }





