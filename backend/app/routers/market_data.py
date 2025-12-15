from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import yfinance as yf
from datetime import datetime, timedelta
import pandas as pd
from pydantic import BaseModel

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
        # Convert timestamps to datetime
        start_dt = datetime.fromtimestamp(from_time)
        end_dt = datetime.fromtimestamp(to_time)
        
        # Adjust symbol for Yahoo Finance
        # Futures often need specific formatting or might not be available in real-time without delay,
        # but continuous contracts might work (e.g. ES=F).
        yf_symbol = symbol
        if symbol == "ES": yf_symbol = "ES=F"
        elif symbol == "NQ": yf_symbol = "NQ=F"
        elif symbol == "YM": yf_symbol = "YM=F"
        elif symbol == "RTY": yf_symbol = "RTY=F"
        elif symbol == "GC": yf_symbol = "GC=F"
        elif symbol == "CL": yf_symbol = "CL=F"
        # Add more mappings as needed

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
        print(f"Error fetching market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
