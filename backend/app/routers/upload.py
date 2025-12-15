"""
Upload Router
=============
File upload and CSV parsing endpoints (Stateless)
"""

import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
import tempfile
import json
import shutil

# Add src directory to path for parser imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from ..schemas.upload import UploadResponse, ParseResult, ParseError
from ..config import settings

# Import parsers from main project
from src.parsers import ParserFactory
from src.models.account import Broker
from src.models.trade import Trade as ParsedTrade

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("", response_model=Dict[str, Any])
async def parse_trades_file(
    file: UploadFile = File(...),
    broker: Optional[str] = Form(None),
):
    """
    Parse a CSV file with trade data and return JSON.
    Does NOT save to database.
    
    - **file**: CSV file with trade data
    - **broker**: Optional broker hint (auto-detected if not provided)
    """
    
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
        
        # Convert parse result to JSON-serializable format
        errors = [
            {
                "row_number": e.row_number,
                "column": e.column,
                "message": e.message,
                "raw_value": e.raw_value
            }
            for e in parse_result.errors
        ]
        
        # Helper to convert ParsedTrade to dictionary
        def trade_to_dict(t: ParsedTrade) -> Dict[str, Any]:
            return {
                "broker_trade_id": t.broker_trade_id,
                "symbol": t.symbol,
                "asset_type": t.asset_type.value,
                "direction": t.direction.value,
                "status": t.status.value,
                "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                "exit_time": t.exit_time.isoformat() if t.exit_time else None,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "quantity": t.quantity,
                "commission": t.commission,
                "tags": t.tags,
                "notes": t.notes,
                "raw_data": t.raw_data
            }

        trades_json = [trade_to_dict(t) for t in parse_result.trades.trades]
        
        api_parse_result = {
            "success": not parse_result.has_errors or parse_result.parsed_successfully > 0,
            "broker_detected": parse_result.trades.broker_name or "generic",
            "total_rows": parse_result.total_rows,
            "parsed_successfully": parse_result.parsed_successfully,
            "skipped_rows": parse_result.skipped_rows,
            "success_rate": parse_result.success_rate,
            "errors": errors,
            "warnings": parse_result.warnings
        }
        
        return {
            "success": True,
            "message": f"Successfully parsed {len(trades_json)} trades",
            "parse_result": api_parse_result,
            "trades": trades_json,
            "win_rate": parse_result.trades.win_rate
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
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





