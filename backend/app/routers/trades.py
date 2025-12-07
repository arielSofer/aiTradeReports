"""
Trades Router
=============
Trade management endpoints
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.auth import get_current_user
from ..services.trade_service import TradeService
from ..models.user import User
from ..models.trade import TradeDirection, TradeStatus
from ..schemas.trade import TradeCreate, TradeResponse, TradeUpdate, TradeChartData
import json

router = APIRouter(prefix="/trades", tags=["Trades"])


@router.get("", response_model=List[TradeResponse])
async def get_trades(
    account_id: Optional[int] = None,
    symbol: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[TradeStatus] = None,
    direction: Optional[TradeDirection] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trades with optional filters
    
    - **account_id**: Filter by account
    - **symbol**: Filter by symbol (e.g., AAPL)
    - **start_date**: Filter by start date
    - **end_date**: Filter by end date
    - **status**: Filter by status (open/closed)
    - **direction**: Filter by direction (long/short)
    """
    trades = await TradeService.get_trades(
        db,
        user_id=current_user.id,
        account_id=account_id,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        status=status,
        direction=direction,
        limit=limit,
        offset=offset
    )
    
    # Convert to response with calculated fields
    results = []
    for trade in trades:
        trade_dict = {
            "id": trade.id,
            "account_id": trade.account_id,
            "broker_trade_id": trade.broker_trade_id,
            "symbol": trade.symbol,
            "direction": trade.direction,
            "asset_type": trade.asset_type,
            "status": trade.status,
            "entry_time": trade.entry_time,
            "exit_time": trade.exit_time,
            "entry_price": trade.entry_price,
            "exit_price": trade.exit_price,
            "quantity": trade.quantity,
            "commission": trade.commission,
            "stop_loss": trade.stop_loss,
            "take_profit": trade.take_profit,
            "pnl_gross": trade.pnl_gross,
            "pnl_net": trade.pnl_net,
            "pnl_percent": float(trade.pnl_percent) if trade.pnl_percent else None,
            "r_multiple": float(trade.r_multiple) if trade.r_multiple else None,
            "created_at": trade.created_at,
            "tags": json.loads(trade.tags) if trade.tags else [],
            "notes": trade.notes,
        }
        
        # Calculate duration
        if trade.exit_time and trade.entry_time:
            duration = (trade.exit_time - trade.entry_time).total_seconds() / 60
            trade_dict["duration_minutes"] = int(duration)
        else:
            trade_dict["duration_minutes"] = None
        
        # Is winner
        trade_dict["is_winner"] = trade.pnl_net > 0 if trade.pnl_net else None
        
        results.append(TradeResponse(**trade_dict))
    
    return results


@router.get("/chart-data", response_model=List[TradeChartData])
async def get_trades_for_chart(
    account_id: Optional[int] = None,
    symbol: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trades formatted for chart display
    
    Returns data compatible with TradingView Lightweight Charts markers.
    """
    trades = await TradeService.get_trades(
        db,
        user_id=current_user.id,
        account_id=account_id,
        symbol=symbol,
        limit=limit
    )
    
    chart_data = []
    for trade in trades:
        markers = [
            {
                "time": int(trade.entry_time.timestamp()),
                "position": "belowBar" if trade.direction == TradeDirection.LONG else "aboveBar",
                "color": "#2196F3",
                "shape": "arrowUp" if trade.direction == TradeDirection.LONG else "arrowDown",
                "text": f"Entry @ {float(trade.entry_price):.2f}"
            }
        ]
        
        if trade.exit_time and trade.exit_price:
            is_winner = trade.pnl_net and trade.pnl_net > 0
            markers.append({
                "time": int(trade.exit_time.timestamp()),
                "position": "aboveBar" if trade.direction == TradeDirection.LONG else "belowBar",
                "color": "#4CAF50" if is_winner else "#F44336",
                "shape": "arrowDown" if trade.direction == TradeDirection.LONG else "arrowUp",
                "text": f"Exit @ {float(trade.exit_price):.2f}"
            })
        
        chart_data.append(TradeChartData(
            symbol=trade.symbol,
            entry_time=int(trade.entry_time.timestamp()),
            exit_time=int(trade.exit_time.timestamp()) if trade.exit_time else None,
            entry_price=float(trade.entry_price),
            exit_price=float(trade.exit_price) if trade.exit_price else None,
            direction=trade.direction.value,
            quantity=float(trade.quantity),
            pnl=float(trade.pnl_net) if trade.pnl_net else None,
            pnl_percent=float(trade.pnl_percent) if trade.pnl_percent else None,
            is_winner=trade.pnl_net > 0 if trade.pnl_net else None,
            tags=json.loads(trade.tags) if trade.tags else [],
            markers=markers
        ))
    
    return chart_data


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific trade by ID
    """
    trade = await TradeService.get_trade_by_id(db, trade_id, current_user.id)
    
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found"
        )
    
    return TradeResponse.model_validate(trade)


@router.post("", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def create_trade(
    trade_data: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new trade manually
    """
    # Verify account ownership
    from ..models.account import Account
    from sqlalchemy import select
    
    result = await db.execute(
        select(Account).where(
            Account.id == trade_data.account_id,
            Account.user_id == current_user.id
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    trade = await TradeService.create_trade(
        db,
        trade_data=trade_data.model_dump(exclude={"account_id"}),
        account_id=trade_data.account_id
    )
    
    return TradeResponse.model_validate(trade)


@router.put("/{trade_id}", response_model=TradeResponse)
async def update_trade(
    trade_id: int,
    update_data: TradeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a trade
    """
    trade = await TradeService.get_trade_by_id(db, trade_id, current_user.id)
    
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found"
        )
    
    updated = await TradeService.update_trade(
        db,
        trade=trade,
        update_data=update_data.model_dump(exclude_unset=True)
    )
    
    return TradeResponse.model_validate(updated)


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a trade
    """
    trade = await TradeService.get_trade_by_id(db, trade_id, current_user.id)
    
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found"
        )
    
    await TradeService.delete_trade(db, trade)

