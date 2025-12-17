from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import os

from datetime import datetime, timedelta
import pandas as pd
from pydantic import BaseModel

# yfinance is optionally imported inside the endpoint to prevent app crash if not installed

router = APIRouter(
    prefix="/market-data",
    tags=["Market Data"]
)

class Candle(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None

@router.get("/candles", response_model=List[Candle])
async def get_candles(
    symbol: str,
    from_time: int,  # Unix timestamp
    to_time: int,    # Unix timestamp
    interval: str = "15m"
):
    """
    Fetch historical candle data from Yahoo Finance.
    """
    try:
        # Lazy import yfinance to prevent app crash if not installed
        try:
            import yfinance as yf
            # Configure cache location for Vercel's read-only filesystem
            cache_dir = "/tmp/yf_cache"
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir, exist_ok=True)
            yf.set_tz_cache_location(cache_dir)
        except ImportError:
            raise HTTPException(
                status_code=503, 
                detail="Market data service unavailable - yfinance not installed"
            )
        
        # Convert timestamps to datetime
        start_dt = datetime.fromtimestamp(from_time)
        end_dt = datetime.fromtimestamp(to_time)
        
        # Normalize symbol: handle Tradovate and other formats
        # F.US.MNQ -> MNQ, MNQZ5 -> MNQ, etc.
        import re
        normalized_symbol = symbol.upper().strip()
        
        # Strip "F.US." or similar prefixes
        if normalized_symbol.startswith("F.US."):
            normalized_symbol = normalized_symbol[5:]  # Remove "F.US."
        elif normalized_symbol.startswith("F."):
            normalized_symbol = normalized_symbol[2:]  # Remove "F."
        
        # Strip futures contract suffix (e.g., Z5, H4, M6)
        # Pattern: base symbol + month letter + year digit(s)
        futures_pattern = r'^([A-Z]{2,4})[FGHJKMNQUVXZ]\d{1,2}$'
        match = re.match(futures_pattern, normalized_symbol)
        if match:
            normalized_symbol = match.group(1)
        
        # Symbol to Yahoo Finance mapping
        symbol_map = {
            # Full contracts
            "ES": "ES=F", "NQ": "NQ=F", "YM": "YM=F", "RTY": "RTY=F",
            "CL": "CL=F", "GC": "GC=F", "SI": "SI=F", "HG": "HG=F", "NG": "NG=F",
            "ZB": "ZB=F", "ZN": "ZN=F", "ZF": "ZF=F", "ZT": "ZT=F",
            "6E": "6E=F", "6B": "6B=F", "6J": "6J=F", "6A": "6A=F",
            # Micros
            "MES": "MES=F", "MNQ": "MNQ=F", "MYM": "MYM=F", "M2K": "M2K=F",
            "MGC": "MGC=F", "SIL": "SIL=F", "QI": "QI=F", "QO": "QO=F",
            "MN": "MN=F", "MCL": "MCL=F"
        }
        
        yf_symbol = symbol_map.get(normalized_symbol, normalized_symbol)

        # Fetch data
        ticker = yf.Ticker(yf_symbol)
        history = ticker.history(start=start_dt, end=end_dt, interval=interval)
        
        if history.empty:
             # Try without Future suffix if failed (maybe stock?)
             if yf_symbol != symbol:
                 ticker = yf.Ticker(symbol)
                 history = ticker.history(start=start_dt, end=end_dt, interval=interval)

        candles = []
        for index, row in history.iterrows():
            candles.append({
                "time": int(index.timestamp()),
                "open": row["Open"],
                "high": row["High"],
                "low": row["Low"],
                "close": row["Close"],
                "volume": row["Volume"]
            })
            
        return candles

    except Exception as e:
        import traceback
        error_msg = f"Error fetching market data: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        # Return the error details to the client for debugging
        raise HTTPException(status_code=500, detail=error_msg)
