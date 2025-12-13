"""
Upload Schemas
==============
Pydantic models for file upload API
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class ParseError(BaseModel):
    """Single parsing error"""
    row_number: int
    column: Optional[str] = None
    message: str
    raw_value: Optional[str] = None


class ParseResult(BaseModel):
    """Result from parsing a CSV file"""
    success: bool
    broker_detected: str
    total_rows: int
    parsed_successfully: int
    skipped_rows: int
    success_rate: float
    
    errors: List[ParseError] = []
    warnings: List[str] = []


class UploadResponse(BaseModel):
    """Response from file upload"""
    success: bool
    message: str
    parse_result: ParseResult
    trades_created: int
    
    # Summary of imported trades
    total_pnl: float
    win_rate: Optional[float] = None
    date_range: Optional[Dict[str, str]] = None





