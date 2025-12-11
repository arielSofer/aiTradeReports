"""
Trade Service
=============
Business logic for trade operations
"""

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from sqlalchemy.orm import selectinload
import json

from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType
from ..models.account import Account
from ..schemas.trade import TradeStats, DailyPnL, HourlyStats


class TradeService:
    """Trade business logic service"""
    
    @staticmethod
    async def get_trades(
        db: AsyncSession,
        user_id: int,
        account_id: Optional[int] = None,
        symbol: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[TradeStatus] = None,
        direction: Optional[TradeDirection] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Trade]:
        """Get trades with filters"""
        
        # Build query with account join for user filtering
        query = (
            select(Trade)
            .join(Account)
            .where(Account.user_id == user_id)
        )
        
        # Apply filters
        if account_id:
            query = query.where(Trade.account_id == account_id)
        if symbol:
            query = query.where(Trade.symbol == symbol.upper())
        if start_date:
            query = query.where(Trade.entry_time >= start_date)
        if end_date:
            query = query.where(Trade.entry_time <= end_date)
        if status:
            query = query.where(Trade.status == status)
        if direction:
            query = query.where(Trade.direction == direction)
        
        # Order and paginate
        query = query.order_by(Trade.entry_time.desc()).offset(offset).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @staticmethod
    async def get_trade_by_id(
        db: AsyncSession,
        trade_id: int,
        user_id: int
    ) -> Optional[Trade]:
        """Get a single trade by ID"""
        query = (
            select(Trade)
            .join(Account)
            .where(
                and_(
                    Trade.id == trade_id,
                    Account.user_id == user_id
                )
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create_trade(
        db: AsyncSession,
        trade_data: dict,
        account_id: int
    ) -> Trade:
        """Create a new trade"""
        
        # Convert tags list to JSON string
        tags = trade_data.pop("tags", None)
        if tags:
            trade_data["tags"] = json.dumps(tags)
        
        trade = Trade(
            account_id=account_id,
            **trade_data
        )
        
        # Calculate P&L if trade is closed
        if trade.exit_price:
            trade.status = TradeStatus.CLOSED
            trade.calculate_pnl()
        
        db.add(trade)
        await db.commit()
        await db.refresh(trade)
        return trade
    
    @staticmethod
    async def update_trade(
        db: AsyncSession,
        trade: Trade,
        update_data: dict
    ) -> Trade:
        """Update a trade"""
        
        # Convert tags list to JSON string
        if "tags" in update_data and update_data["tags"]:
            update_data["tags"] = json.dumps(update_data["tags"])
        
        for key, value in update_data.items():
            if value is not None:
                setattr(trade, key, value)
        
        # Recalculate P&L if exit price changed
        if trade.exit_price:
            trade.calculate_pnl()
        
        await db.commit()
        await db.refresh(trade)
        return trade
    
    @staticmethod
    async def delete_trade(db: AsyncSession, trade: Trade) -> None:
        """Delete a trade"""
        await db.delete(trade)
        await db.commit()
    
    @staticmethod
    async def get_statistics(
        db: AsyncSession,
        user_id: int,
        account_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> TradeStats:
        """Calculate trading statistics"""
        
        # Base query with user filter
        base_query = (
            select(Trade)
            .join(Account)
            .where(Account.user_id == user_id)
        )
        
        if account_id:
            base_query = base_query.where(Trade.account_id == account_id)
        if start_date:
            base_query = base_query.where(Trade.entry_time >= start_date)
        if end_date:
            base_query = base_query.where(Trade.entry_time <= end_date)
        
        # Get all trades
        result = await db.execute(base_query)
        trades = result.scalars().all()
        
        if not trades:
            return TradeStats(
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                open_trades=0,
                total_pnl=Decimal("0"),
                total_commission=Decimal("0"),
                gross_profit=Decimal("0"),
                gross_loss=Decimal("0")
            )
        
        # Calculate stats
        closed_trades = [t for t in trades if t.status == TradeStatus.CLOSED]
        open_trades = [t for t in trades if t.status == TradeStatus.OPEN]
        
        winners = [t for t in closed_trades if t.pnl_net and t.pnl_net > 0]
        losers = [t for t in closed_trades if t.pnl_net and t.pnl_net < 0]
        
        total_pnl = sum((t.pnl_net or Decimal("0")) for t in closed_trades)
        total_commission = sum(t.commission for t in trades)
        
        gross_profit = sum(t.pnl_net for t in winners) if winners else Decimal("0")
        gross_loss = abs(sum(t.pnl_net for t in losers)) if losers else Decimal("0")
        
        win_rate = None
        if closed_trades:
            win_rate = (len(winners) / len(closed_trades)) * 100
        
        profit_factor = None
        if gross_loss > 0:
            profit_factor = float(gross_profit / gross_loss)
        
        avg_winner = sum(t.pnl_net for t in winners) / len(winners) if winners else None
        avg_loser = abs(sum(t.pnl_net for t in losers) / len(losers)) if losers else None
        
        largest_winner = max((t.pnl_net for t in winners), default=None)
        largest_loser = min((t.pnl_net for t in losers), default=None)
        if largest_loser:
            largest_loser = abs(largest_loser)
        
        # Calculate daily P&L
        daily_pnl = TradeService._calculate_daily_pnl(closed_trades)
        
        # Calculate hourly stats
        hourly_stats = TradeService._calculate_hourly_stats(closed_trades)
        
        # Find best/worst trading hours
        best_hour = None
        worst_hour = None
        if hourly_stats:
            profitable_hours = [h for h in hourly_stats if h.pnl > 0]
            losing_hours = [h for h in hourly_stats if h.pnl < 0]
            if profitable_hours:
                best_hour = max(profitable_hours, key=lambda x: x.pnl).hour
            if losing_hours:
                worst_hour = min(losing_hours, key=lambda x: x.pnl).hour
        
        # Calculate stats by symbol
        by_symbol = TradeService._calculate_by_symbol(closed_trades)
        
        # Calculate streaks
        current_streak, best_streak, worst_streak = TradeService._calculate_streaks(closed_trades)
        
        return TradeStats(
            total_trades=len(trades),
            winning_trades=len(winners),
            losing_trades=len(losers),
            open_trades=len(open_trades),
            total_pnl=total_pnl,
            total_commission=total_commission,
            gross_profit=gross_profit,
            gross_loss=gross_loss,
            win_rate=win_rate,
            profit_factor=profit_factor,
            avg_winner=avg_winner,
            avg_loser=avg_loser,
            largest_winner=largest_winner,
            largest_loser=largest_loser,
            best_trading_hour=best_hour,
            worst_trading_hour=worst_hour,
            by_symbol=by_symbol,
            daily_pnl=daily_pnl,
            hourly_stats=hourly_stats,
            current_streak=current_streak,
            best_streak=best_streak,
            worst_streak=worst_streak
        )
    
    @staticmethod
    def _calculate_daily_pnl(trades: List[Trade]) -> List[DailyPnL]:
        """Calculate daily P&L"""
        daily_data: Dict[date, Dict] = {}
        
        for trade in sorted(trades, key=lambda t: t.exit_time or t.entry_time):
            if not trade.exit_time or not trade.pnl_net:
                continue
            
            d = trade.exit_time.date()
            if d not in daily_data:
                daily_data[d] = {
                    "pnl": Decimal("0"),
                    "trades": 0,
                    "winners": 0,
                    "losers": 0
                }
            
            daily_data[d]["pnl"] += trade.pnl_net
            daily_data[d]["trades"] += 1
            if trade.pnl_net > 0:
                daily_data[d]["winners"] += 1
            else:
                daily_data[d]["losers"] += 1
        
        # Calculate cumulative P&L
        result = []
        cumulative = Decimal("0")
        for d in sorted(daily_data.keys()):
            data = daily_data[d]
            cumulative += data["pnl"]
            result.append(DailyPnL(
                date=d,
                pnl=data["pnl"],
                trades_count=data["trades"],
                winners=data["winners"],
                losers=data["losers"],
                cumulative_pnl=cumulative
            ))
        
        return result
    
    @staticmethod
    def _calculate_hourly_stats(trades: List[Trade]) -> List[HourlyStats]:
        """Calculate hourly statistics"""
        hourly: Dict[int, Dict] = {h: {"trades": 0, "wins": 0, "pnl": Decimal("0")} for h in range(24)}
        
        for trade in trades:
            if not trade.pnl_net:
                continue
            hour = trade.entry_time.hour
            hourly[hour]["trades"] += 1
            hourly[hour]["pnl"] += trade.pnl_net
            if trade.pnl_net > 0:
                hourly[hour]["wins"] += 1
        
        return [
            HourlyStats(
                hour=h,
                trades=data["trades"],
                wins=data["wins"],
                pnl=data["pnl"],
                win_rate=(data["wins"] / data["trades"] * 100) if data["trades"] > 0 else None
            )
            for h, data in hourly.items()
            if data["trades"] > 0
        ]
    
    @staticmethod
    def _calculate_by_symbol(trades: List[Trade]) -> Dict[str, Dict]:
        """Calculate stats by symbol"""
        by_symbol: Dict[str, Dict] = {}
        
        for trade in trades:
            if trade.symbol not in by_symbol:
                by_symbol[trade.symbol] = {
                    "trades": 0,
                    "winners": 0,
                    "losers": 0,
                    "pnl": Decimal("0")
                }
            
            by_symbol[trade.symbol]["trades"] += 1
            if trade.pnl_net:
                by_symbol[trade.symbol]["pnl"] += trade.pnl_net
                if trade.pnl_net > 0:
                    by_symbol[trade.symbol]["winners"] += 1
                else:
                    by_symbol[trade.symbol]["losers"] += 1
        
        # Calculate win rate for each symbol
        for symbol, data in by_symbol.items():
            total = data["winners"] + data["losers"]
            data["win_rate"] = (data["winners"] / total * 100) if total > 0 else None
            data["pnl"] = float(data["pnl"])
        
        return by_symbol
    
    @staticmethod
    def _calculate_streaks(trades: List[Trade]) -> tuple:
        """Calculate winning/losing streaks"""
        if not trades:
            return 0, 0, 0
        
        sorted_trades = sorted(trades, key=lambda t: t.exit_time or t.entry_time)
        
        current_streak = 0
        best_streak = 0
        worst_streak = 0
        temp_streak = 0
        
        for trade in sorted_trades:
            if not trade.pnl_net:
                continue
            
            is_winner = trade.pnl_net > 0
            
            if is_winner:
                if temp_streak > 0:
                    temp_streak += 1
                else:
                    temp_streak = 1
                best_streak = max(best_streak, temp_streak)
            else:
                if temp_streak < 0:
                    temp_streak -= 1
                else:
                    temp_streak = -1
                worst_streak = min(worst_streak, temp_streak)
            
            current_streak = temp_streak
        
        return current_streak, best_streak, abs(worst_streak)




