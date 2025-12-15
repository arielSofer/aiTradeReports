"""
Trades Router
=============
Trade management endpoints
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.auth import get_current_user
from ..models.user import User
from ..models.trade import Trade, TradeDirection, TradeStatus
from ..schemas.trade import (
    TradeResponse, 
    TradeCreate, 
    TradeUpdate, 
    TradeChartData
)
from ..services.trade_service import TradeService

router = APIRouter(prefix="/trades", tags=["Trades"])


@router.get("", response_model=List[TradeResponse])
async def get_trades(
    account_id: Optional[int] = None,
    symbol: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[TradeStatus] = None,
    direction: Optional[TradeDirection] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trades with filtering
    """
    return await TradeService.get_trades(
        db=db,
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


@router.get("/chart-data", response_model=List[TradeChartData])
async def get_chart_data(
    account_id: Optional[int] = None,
    symbol: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get trade data formatted for charts
    """
    trades = await TradeService.get_trades(
        db=db,
        user_id=current_user.id,
        account_id=account_id,
        symbol=symbol,
        limit=1000  # Higher limit for charts
    )
    
    chart_data = []
    for trade in trades:
        data = {
            "symbol": trade.symbol,
            "entry_time": int(trade.entry_time.timestamp() * 1000),
            "entry_price": float(trade.entry_price),
            "direction": trade.direction,
            "quantity": float(trade.quantity),
            "tags": [] # TODO: Parse tags if stored as JSON
        }
        
        if trade.exit_time:
            data["exit_time"] = int(trade.exit_time.timestamp() * 1000)
            data["exit_price"] = float(trade.exit_price) if trade.exit_price else None
            data["pnl"] = float(trade.pnl_net) if trade.pnl_net else None
            data["is_winner"] = trade.pnl_net > 0 if trade.pnl_net else None
            
        chart_data.append(data)
        
    return chart_data


@router.post("", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def create_trade(
    trade_data: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new trade
    """
    # Verify account belongs to user (should technically be in service)
    # For now, relying on service or db constraints, but ideally check here
    
    return await TradeService.create_trade(
        db=db,
        trade_data=trade_data.model_dump(exclude={"account_id"}),
        account_id=trade_data.account_id
    )


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific trade
    """
    trade = await TradeService.get_trade_by_id(db, trade_id, current_user.id)
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found"
        )
    return trade


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
        
    return await TradeService.update_trade(
        db=db, 
        trade=trade, 
        update_data=update_data.model_dump(exclude_unset=True)
    )


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
