"""
NinjaTrader 8 Parser
====================

Parser לקבצי Trade Performance מ-NinjaTrader 8.

NinjaTrader 8 יוצא עסקאות בפורמטים שונים:
1. Trade Performance Export (CSV)
2. Trade History Report

פורמט Trade Performance:
Trade #, Instrument, Account, Strategy, Market pos., Quantity, Entry price, Exit price, 
Entry time, Exit time, Entry name, Exit name, Profit, Cum. profit, Commission, MAE, MFE, ETD, Bars

דוגמה:
1,ES 03-24,Sim101,MyStrategy,Long,1,4850.25,4855.50,01/15/2024 10:30:00,01/15/2024 11:45:00,Long Entry,Exit,262.50,262.50,4.04,25.00,312.50,0,15
"""

from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import pandas as pd
import re

from .base import BaseParser
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType
from ..models.account import Broker


class NinjaTrader8Parser(BaseParser):
    """
    Parser לקבצי NinjaTrader 8 Trade Performance
    
    NinjaTrader משתמש בפורמט מיוחד:
    - Futures symbols כוללים חודש ושנה (ES 03-24)
    - Market pos. מציין Long/Short
    - Profit כבר מחושב
    """
    
    BROKER = Broker.NINJA_TRADER
    
    REQUIRED_COLUMNS = [
        "instrument",
        "quantity",
        "entry price",
        "exit price"
    ]
    
    COLUMN_MAPPING = {
        # NinjaTrader column names (case insensitive)
        "trade #": "trade_number",
        "instrument": "symbol",
        "account": "account",
        "strategy": "strategy",
        "market pos.": "direction",
        "market position": "direction",
        "quantity": "quantity",
        "qty": "quantity",
        "entry price": "entry_price",
        "exit price": "exit_price",
        "entry time": "entry_time",
        "exit time": "exit_time",
        "entry name": "entry_name",
        "exit name": "exit_name",
        "profit": "pnl",
        "cum. profit": "cumulative_pnl",
        "commission": "commission",
        "mae": "mae",  # Maximum Adverse Excursion
        "mfe": "mfe",  # Maximum Favorable Excursion
        "etd": "etd",  # End Trade Drawdown
        "bars": "bars",
    }
    
    DATETIME_FORMAT = "%m/%d/%Y %H:%M:%S"
    
    def _normalize_symbol(self, symbol: str) -> str:
        """
        נרמל סימול NinjaTrader
        
        ES 03-24 -> ES
        NQ 12-23 -> NQ
        AAPL -> AAPL
        """
        symbol = symbol.strip()
        
        # הסר חודש ושנה מחוזים עתידיים
        # Pattern: SYMBOL MM-YY or SYMBOL MMYY
        futures_pattern = r'^([A-Z]+)\s*\d{2}[-]?\d{2}$'
        match = re.match(futures_pattern, symbol)
        if match:
            return match.group(1)
        
        return symbol.upper()
    
    def _detect_asset_type(self, symbol: str) -> AssetType:
        """זהה סוג נכס לפי הסימול"""
        
        symbol_upper = symbol.upper()
        
        # Futures - common symbols
        futures_symbols = [
            "ES", "NQ", "YM", "RTY",  # Index futures
            "CL", "GC", "SI", "NG",   # Commodities
            "6E", "6J", "6B", "6A",   # Currency futures
            "ZB", "ZN", "ZF", "ZT",   # Treasury futures
            "MES", "MNQ", "MYM", "M2K",  # Micro futures
        ]
        
        # בדוק אם זה חוזה עתידי
        base_symbol = self._normalize_symbol(symbol)
        if base_symbol in futures_symbols:
            return AssetType.FUTURE
        
        # Forex
        if len(symbol) == 6 and symbol.isalpha():
            return AssetType.FOREX
        
        return AssetType.FUTURE  # NinjaTrader בעיקר לעתידיים
    
    def _parse_nt_datetime(self, value: str) -> datetime:
        """פענח תאריך בפורמט NinjaTrader"""
        
        value_str = str(value).strip()
        
        # NinjaTrader formats
        formats = [
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%y %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        # נסה pandas
        return pd.to_datetime(value_str).to_pydatetime()
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """פענח שורה מ-NinjaTrader"""
        
        # Symbol
        symbol_raw = row.get("symbol", row.get("Instrument", ""))
        if pd.isna(symbol_raw) or not str(symbol_raw).strip():
            return None
        
        symbol = self._normalize_symbol(str(symbol_raw))
        
        # Direction
        direction_raw = row.get("direction", row.get("Market pos.", ""))
        if pd.isna(direction_raw):
            return None
        
        direction_str = str(direction_raw).lower().strip()
        if "long" in direction_str:
            direction = TradeDirection.LONG
        elif "short" in direction_str:
            direction = TradeDirection.SHORT
        else:
            raise ValueError(f"Unknown direction: {direction_raw}")
        
        # Quantity
        quantity = self._parse_decimal(row.get("quantity", 1))
        if quantity <= 0:
            raise ValueError(f"Invalid quantity: {quantity}")
        
        # Prices
        entry_price = self._parse_decimal(row.get("entry_price", row.get("Entry price", 0)))
        exit_price_raw = row.get("exit_price", row.get("Exit price", None))
        
        if entry_price <= 0:
            raise ValueError(f"Invalid entry price: {entry_price}")
        
        exit_price = None
        if pd.notna(exit_price_raw):
            exit_price = self._parse_decimal(exit_price_raw)
        
        # Times
        entry_time = self._parse_nt_datetime(
            row.get("entry_time", row.get("Entry time", ""))
        )
        
        exit_time = None
        exit_time_raw = row.get("exit_time", row.get("Exit time", None))
        if pd.notna(exit_time_raw) and str(exit_time_raw).strip():
            try:
                exit_time = self._parse_nt_datetime(exit_time_raw)
            except:
                pass
        
        # Status
        status = TradeStatus.CLOSED if exit_price else TradeStatus.OPEN
        
        # Commission
        commission = Decimal("0")
        comm_raw = row.get("commission", row.get("Commission", 0))
        if pd.notna(comm_raw):
            commission = abs(Decimal(str(self._parse_decimal(comm_raw))))
        
        # P&L (NinjaTrader כבר מחשב)
        pnl_raw = row.get("pnl", row.get("Profit", None))
        
        # Asset type
        asset_type = self._detect_asset_type(symbol_raw)
        
        # Trade ID
        trade_id = None
        if pd.notna(row.get("trade_number", row.get("Trade #", None))):
            trade_id = str(row.get("trade_number", row.get("Trade #")))
        
        # Strategy (as tag)
        tags = []
        strategy = row.get("strategy", row.get("Strategy", None))
        if pd.notna(strategy) and str(strategy).strip():
            tags.append(str(strategy).strip().lower())
        
        # Entry/Exit names (as notes)
        notes_parts = []
        entry_name = row.get("entry_name", row.get("Entry name", None))
        exit_name = row.get("exit_name", row.get("Exit name", None))
        if pd.notna(entry_name):
            notes_parts.append(f"Entry: {entry_name}")
        if pd.notna(exit_name):
            notes_parts.append(f"Exit: {exit_name}")
        notes = " | ".join(notes_parts) if notes_parts else None
        
        # Raw data with NinjaTrader specific fields
        raw_data = row.to_dict()
        # Add MAE/MFE if available
        if pd.notna(row.get("mae", row.get("MAE", None))):
            raw_data["mae"] = self._parse_decimal(row.get("mae", row.get("MAE")))
        if pd.notna(row.get("mfe", row.get("MFE", None))):
            raw_data["mfe"] = self._parse_decimal(row.get("mfe", row.get("MFE")))
        
        return Trade(
            symbol=symbol,
            direction=direction,
            status=status,
            asset_type=asset_type,
            entry_time=entry_time,
            exit_time=exit_time,
            entry_price=Decimal(str(entry_price)),
            exit_price=Decimal(str(exit_price)) if exit_price else None,
            quantity=Decimal(str(quantity)),
            commission=commission,
            broker_trade_id=trade_id,
            tags=tags,
            notes=notes,
            raw_data=raw_data
        )
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """בדיקת עמודות מותאמת ל-NinjaTrader"""
        df_columns = [col.lower() for col in df.columns]
        
        missing = []
        
        # Instrument/Symbol
        if not any(name in df_columns for name in ["instrument", "symbol"]):
            missing.append("Instrument")
        
        # Quantity
        if not any(name in df_columns for name in ["quantity", "qty"]):
            missing.append("Quantity")
        
        # Entry Price
        if "entry price" not in df_columns:
            missing.append("Entry price")
        
        return missing




