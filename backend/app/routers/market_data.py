from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import os
from datetime import datetime, timedelta
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

# Symbol mapping for CME Globex futures
SYMBOL_MAP = {
    # Micro E-mini futures
    'MNQ': 'MNQ.c.0',
    'MES': 'MES.c.0',
    'M2K': 'M2K.c.0',
    'MYM': 'MYM.c.0',
    'MCL': 'MCL.c.0',
    'MGC': 'MGC.FUT',
    # E-mini futures
    'NQ': 'NQ.c.0',
    'ES': 'ES.c.0',
    'RTY': 'RTY.c.0',
    'YM': 'YM.c.0',
    # Commodities
    'GC': 'GC.FUT',
    'CL': 'CL.c.0',
    'SI': 'SI.c.0',
    'NG': 'NG.c.0',
}

# ... (lines 41-157) ...

        # Determine stype based on symbol format
        stype_in = "continuous"
        if databento_symbol.endswith(".FUT"):
            stype_in = "parent"

        # Fetch data
        data = client.timeseries.get_range(
            dataset="GLBX.MDP3",
            symbols=[databento_symbol],
            schema=schema,
            start=start_dt.isoformat() + "Z",
            end=end_dt.isoformat() + "Z",
            stype_in=stype_in,
        )
        
        # Convert to DataFrame
        df = data.to_df()
        
        if df.empty:
            return []

        # Handle Parent Symbology (Multiple Contracts) - Pick most liquid
        if stype_in == "parent" and 'symbol' in df.columns:
            # Group by symbol and calculate total volume
            volume_by_symbol = df.groupby('symbol')['volume'].sum()
            if not volume_by_symbol.empty:
                best_symbol = volume_by_symbol.idxmax()
                df = df[df['symbol'] == best_symbol].copy()
        
        # Convert to DataFrame
        df = data.to_df()
        
        if df.empty:
            return []
        
        # Build candle list
        candles = []
        for idx, row in df.iterrows():
            candles.append({
                'time': int(idx.timestamp()),
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume']) if 'volume' in row else None,
            })
        
        # Sort by time
        candles.sort(key=lambda x: x['time'])
        
        # Aggregate if needed
        if interval_minutes > 1 and schema == 'ohlcv-1m':
            candles = aggregate_candles(candles, interval_minutes)
        elif interval_minutes == 240 and schema == 'ohlcv-1h':
            candles = aggregate_candles(candles, 4)
        
        return candles

    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Market data service unavailable - databento not installed"
        )
    except Exception as e:
        import traceback
        error_msg = f"Error fetching market data: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

