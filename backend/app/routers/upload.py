"""
Upload Router
=============
File upload and CSV parsing endpoints
"""

import sys
from pathlib import Path
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import tempfile
import json

# Add src directory to path for parser imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from ..database import get_db
from ..services.auth import get_current_user
from ..models.user import User
from ..models.account import Account
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType
from ..schemas.upload import UploadResponse, ParseResult, ParseError
from ..config import settings

# Import parsers from main project
from src.parsers import ParserFactory
from src.models.account import Broker

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("", response_model=UploadResponse)
async def upload_trades_file(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    broker: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a CSV file with trades
    
    - **file**: CSV file with trade data
    - **account_id**: Account to import trades to
    - **broker**: Optional broker hint (auto-detected if not provided)
    
    Supported formats:
    - Generic CSV
    - Interactive Brokers
    - MetaTrader 4/5
    - Binance
    """
    
    # Verify account ownership
    result = await db.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == current_user.id
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Validate file extension
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {settings.allowed_extensions}"
        )
    
    # Read file content
    content = await file.read()
    
    if len(content) > settings.max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.max_file_size / 1024 / 1024}MB"
        )
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Parse the file
        broker_enum = Broker(broker) if broker else None
        parse_result = ParserFactory.parse_file(tmp_path, broker=broker_enum)
        
        # Convert parse result to API schema
        errors = [
            ParseError(
                row_number=e.row_number,
                column=e.column,
                message=e.message,
                raw_value=e.raw_value
            )
            for e in parse_result.errors
        ]
        
        api_parse_result = ParseResult(
            success=not parse_result.has_errors or parse_result.parsed_successfully > 0,
            broker_detected=parse_result.trades.broker_name or "generic",
            total_rows=parse_result.total_rows,
            parsed_successfully=parse_result.parsed_successfully,
            skipped_rows=parse_result.skipped_rows,
            success_rate=parse_result.success_rate,
            errors=errors,
            warnings=parse_result.warnings
        )
        
        if parse_result.parsed_successfully == 0:
            return UploadResponse(
                success=False,
                message="No trades could be parsed from the file",
                parse_result=api_parse_result,
                trades_created=0,
                total_pnl=0.0
            )
        
        # Import trades to database
        trades_created = 0
        total_pnl = Decimal("0")
        min_date = None
        max_date = None
        
        for parsed_trade in parse_result.trades.trades:
            # Convert parsed trade to DB model
            db_trade = Trade(
                account_id=account_id,
                broker_trade_id=parsed_trade.broker_trade_id,
                symbol=parsed_trade.symbol,
                asset_type=AssetType(parsed_trade.asset_type.value),
                direction=TradeDirection(parsed_trade.direction.value),
                status=TradeStatus(parsed_trade.status.value),
                entry_time=parsed_trade.entry_time,
                exit_time=parsed_trade.exit_time,
                entry_price=parsed_trade.entry_price,
                exit_price=parsed_trade.exit_price,
                quantity=parsed_trade.quantity,
                commission=parsed_trade.commission,
                tags=json.dumps(parsed_trade.tags) if parsed_trade.tags else None,
                notes=parsed_trade.notes,
                raw_data=parsed_trade.raw_data
            )
            
            # Calculate P&L
            db_trade.calculate_pnl()
            
            db.add(db_trade)
            trades_created += 1
            
            if db_trade.pnl_net:
                total_pnl += db_trade.pnl_net
            
            # Track date range
            if min_date is None or parsed_trade.entry_time < min_date:
                min_date = parsed_trade.entry_time
            if max_date is None or parsed_trade.entry_time > max_date:
                max_date = parsed_trade.entry_time
        
        await db.commit()
        
        # Calculate win rate
        win_rate = parse_result.trades.win_rate
        
        # Date range
        date_range = None
        if min_date and max_date:
            date_range = {
                "start": min_date.isoformat(),
                "end": max_date.isoformat()
            }
        
        return UploadResponse(
            success=True,
            message=f"Successfully imported {trades_created} trades",
            parse_result=api_parse_result,
            trades_created=trades_created,
            total_pnl=float(total_pnl),
            win_rate=win_rate,
            date_range=date_range
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )
    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/brokers")
async def get_supported_brokers():
    """
    Get list of supported brokers
    """
    return ParserFactory.get_supported_brokers()





