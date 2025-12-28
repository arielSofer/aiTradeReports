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

# Map interval to Databento schema
SCHEMA_MAP = {
    '1m': 'ohlcv-1m',
    '5m': 'ohlcv-1m',   # Fetch 1m, aggregate
    '15m': 'ohlcv-1m',  # Fetch 1m, aggregate
    '30m': 'ohlcv-1m',  # Fetch 1m, aggregate
    '1h': 'ohlcv-1h',
    '4h': 'ohlcv-1h',   # Fetch 1h, aggregate
    '1d': 'ohlcv-1d',
}

# Interval to minutes
INTERVAL_MINUTES = {
    '1m': 1, '5m': 5, '15m': 15, '30m': 30,
    '1h': 60, '4h': 240, '1d': 1440,
}

# Number of candles before and after trade
CANDLES_BUFFER = 50


def normalize_symbol(raw_symbol: str) -> tuple[str, str]:
    """
    Normalize symbol from various formats to base symbol.
    Returns (base_symbol, specific_contract) where specific_contract is the 
    full contract symbol like 'MNQH6' or None if generic.
    """
    import re
    symbol = raw_symbol.upper().strip()
    
    # Handle Tradovate format: F.US.MNQ -> MNQ
    if symbol.startswith("F.US."):
        symbol = symbol[5:]
    elif symbol.startswith("F."):
        symbol = symbol[2:]
    
    # Check if it's a specific contract (e.g., MNQZ24, MNQH6, ESH25)
    # Pattern: 2-4 letters + month code (FGHJKMNQUVXZ) + 1-2 digit year
    futures_pattern = r'^([A-Z]{2,4})([FGHJKMNQUVXZ])(\d{1,2})$'
    match = re.match(futures_pattern, symbol)
    if match:
        base = match.group(1)
        month_code = match.group(2)
        year = match.group(3)
        # Return base symbol and the specific contract
        # Format for Databento: MNQH5 -> MNQ (base), MNQH5.FUT (specific)
        specific_contract = f"{base}{month_code}{year}.FUT"
        return base, specific_contract
    
    return symbol, None


def aggregate_candles(candles: List[dict], interval_minutes: int) -> List[dict]:
    """Aggregate 1m candles to larger timeframes."""
    if interval_minutes <= 1:
        return candles
    
    aggregated = []
    interval_seconds = interval_minutes * 60
    current_bucket = None
    
    for candle in candles:
        bucket_start = (candle['time'] // interval_seconds) * interval_seconds
        
        if current_bucket is None or current_bucket['time'] != bucket_start:
            if current_bucket:
                aggregated.append(current_bucket)
            current_bucket = {
                'time': bucket_start,
                'open': candle['open'],
                'high': candle['high'],
                'low': candle['low'],
                'close': candle['close'],
                'volume': candle.get('volume', 0),
            }
        else:
            current_bucket['high'] = max(current_bucket['high'], candle['high'])
            current_bucket['low'] = min(current_bucket['low'], candle['low'])
            current_bucket['close'] = candle['close']
            current_bucket['volume'] = current_bucket.get('volume', 0) + candle.get('volume', 0)
    
    if current_bucket:
        aggregated.append(current_bucket)
    
    return aggregated


@router.get("/candles", response_model=List[Candle])
async def get_candles(
    symbol: str,
    from_time: int,  # Unix timestamp
    to_time: int,    # Unix timestamp
    interval: str = "15m"
):
    """
    Fetch historical candle data from Databento.
    Returns 50 candles before and 50 candles after the specified time range.
    """
    try:
        import databento as db
        
        # Get API key from environment
        api_key = os.environ.get("DATABENTO_API_KEY")
        if not api_key:
            print("ERROR: DATABENTO_API_KEY not found in environment")
            raise HTTPException(
                status_code=503,
                detail="Market data service unavailable - DATABENTO_API_KEY not configured"
            )
        
        # Debug logging for API key (safe mask)
        key_len = len(api_key)
        start_chars = api_key[:4] if key_len > 4 else "***"
        print(f"DEBUG: Using Databento API key. Length: {key_len}, Starts with: {start_chars}...")
        
        # Normalize and map symbol
        base_symbol, specific_contract = normalize_symbol(symbol)
        
        # For futures, use the continuous contract or parent symbology
        # Databento raw_symbol format doesn't work well for specific contracts
        # Instead, use the base symbol with parent or continuous symbology
        databento_symbol = SYMBOL_MAP.get(base_symbol, f"{base_symbol}.c.0")
        
        # Determine stype based on symbol format
        if databento_symbol.endswith(".FUT"):
            stype_in = "parent"
        else:
            stype_in = "continuous"
            
        print(f"DEBUG: Symbol '{symbol}' -> base: '{base_symbol}' -> databento: '{databento_symbol}', stype: {stype_in}")
        
        # Get schema
        schema = SCHEMA_MAP.get(interval, 'ohlcv-1m')
        interval_minutes = INTERVAL_MINUTES.get(interval, 15)
        
        # Calculate time range with buffer
        interval_seconds = interval_minutes * 60
        buffer_seconds = (CANDLES_BUFFER + 5) * interval_seconds
        
        start_dt = datetime.utcfromtimestamp(from_time - buffer_seconds)
        end_dt = datetime.utcfromtimestamp(to_time + buffer_seconds)
        
        # Initialize Databento client
        client = db.Historical(api_key)

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
