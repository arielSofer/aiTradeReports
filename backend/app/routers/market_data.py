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
        yf_symbol = symbol
        
        # Mappings for Futures
        # Full contracts
        if symbol == "ES": yf_symbol = "ES=F"
        elif symbol == "NQ": yf_symbol = "NQ=F"
        elif symbol == "YM": yf_symbol = "YM=F"
        elif symbol == "RTY": yf_symbol = "RTY=F"
        elif symbol == "CL": yf_symbol = "CL=F"
        elif symbol == "GC": yf_symbol = "GC=F"
        elif symbol == "SI": yf_symbol = "SI=F"
        elif symbol == "HG": yf_symbol = "HG=F"
        elif symbol == "NG": yf_symbol = "NG=F"
        elif symbol == "ZB": yf_symbol = "ZB=F"
        elif symbol == "ZN": yf_symbol = "ZN=F"
        elif symbol == "ZF": yf_symbol = "ZF=F"
        elif symbol == "ZT": yf_symbol = "ZT=F"
        elif symbol == "6E": yf_symbol = "6E=F" # Euro
        elif symbol == "6B": yf_symbol = "6B=F" # British Pound
        elif symbol == "6J": yf_symbol = "6J=F" # Japanese Yen
        elif symbol == "6A": yf_symbol = "6A=F" # Australian Dollar
        
        # Micros
        elif symbol == "MES": yf_symbol = "MES=F"
        elif symbol == "MNQ": yf_symbol = "MNQ=F"
        elif symbol == "MYM": yf_symbol = "MYM=F"
        elif symbol == "M2K": yf_symbol = "M2K=F"
        elif symbol == "MGC": yf_symbol = "MGC=F"
        elif symbol == "SIL": yf_symbol = "SIL=F" # Micro Silver
        elif symbol == "QI": yf_symbol = "QI=F" # Micro Silver (alternative)
        elif symbol == "QO": yf_symbol = "QO=F" # Micro Gold (alternative)
        elif symbol == "MN": yf_symbol = "MN=F" # Micro Natural Gas? Depends. 
        elif symbol == "MCL": yf_symbol = "MCL=F" # Micro Crude Oil

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
