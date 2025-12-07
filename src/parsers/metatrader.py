"""
MetaTrader 4/5 Parser
=====================

Parser לקבצי היסטוריית עסקאות מ-MetaTrader 4 ו-MetaTrader 5.

פורמט MT4 Account History Export:
Ticket, Open Time, Type, Size, Symbol, Price, S/L, T/P, Close Time, Close Price, Commission, Swap, Profit

פורמט MT5:
Position, Symbol, Time, Type, Volume, Price, S/L, T/P, Time (close), Price (close), Commission, Swap, Profit
"""

from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import pandas as pd
import re

from .base import BaseParser
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType
from ..models.account import Broker


class MetaTrader4Parser(BaseParser):
    """
    Parser לקבצי MetaTrader 4
    
    MT4 יוצא עסקאות בפורמט HTML או CSV.
    כל עסקה כוללת את נקודת הכניסה והיציאה באותה שורה.
    """
    
    BROKER = Broker.METATRADER4
    
    REQUIRED_COLUMNS = [
        "ticket",  # או position
        "symbol",
        "type",  # buy/sell
        "size",  # או volume
    ]
    
    COLUMN_MAPPING = {
        # MT4 column names
        "ticket": "ticket",
        "open time": "entry_time",
        "type": "direction",
        "size": "quantity",
        "price": "entry_price",
        "s/l": "stop_loss",
        "t/p": "take_profit",
        "close time": "exit_time",
        "close price": "exit_price",
        "commission": "commission",
        "swap": "swap",
        "profit": "pnl",
        
        # MT5 variants
        "position": "ticket",
        "volume": "quantity",
        "time": "entry_time",
        "time.1": "exit_time",  # Pandas adds .1 for duplicate column names
        "price.1": "exit_price",
    }
    
    DATETIME_FORMAT = "%Y.%m.%d %H:%M:%S"
    
    def _detect_asset_type(self, symbol: str) -> AssetType:
        """זהה סוג נכס לפי הסימול ב-MT4"""
        
        symbol_upper = symbol.upper()
        
        # Forex pairs (6 characters, two 3-letter currencies)
        forex_pattern = r'^[A-Z]{6}$'
        forex_symbols = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", 
                         "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"]
        
        if re.match(forex_pattern, symbol_upper) or symbol_upper in forex_symbols:
            return AssetType.FOREX
        
        # Crypto pairs
        crypto_base = ["BTC", "ETH", "XRP", "LTC", "BCH", "ADA", "DOT", "LINK"]
        if any(symbol_upper.startswith(c) for c in crypto_base):
            return AssetType.CRYPTO
        
        # Indices (usually have numbers or specific patterns)
        indices = ["US30", "US500", "NAS100", "GER30", "UK100", "JPN225", "SPX500"]
        if any(idx in symbol_upper for idx in indices):
            return AssetType.CFD
        
        # Gold, Silver, Oil etc.
        commodities = ["XAUUSD", "XAGUSD", "GOLD", "SILVER", "OIL", "USOIL", "UKOIL"]
        if any(comm in symbol_upper for comm in commodities):
            return AssetType.CFD
        
        return AssetType.CFD  # ברירת מחדל ל-MT4
    
    def _parse_mt_direction(self, type_value: str) -> str:
        """פענח כיוון עסקה מ-MT4/MT5"""
        
        type_str = str(type_value).lower().strip()
        
        if "buy" in type_str:
            return "long"
        elif "sell" in type_str:
            return "short"
        elif type_str == "0":  # MT4 sometimes uses 0 for buy
            return "long"
        elif type_str == "1":  # MT4 sometimes uses 1 for sell
            return "short"
        else:
            raise ValueError(f"Unknown order type: {type_value}")
    
    def _is_trading_row(self, row: pd.Series) -> bool:
        """בדוק אם השורה היא עסקת מסחר (ולא פקודה ממתינה)"""
        
        order_type = str(row.get("direction", row.get("type", ""))).lower()
        
        # סנן פקודות ממתינות (pending orders)
        pending_types = ["buy limit", "sell limit", "buy stop", "sell stop", 
                         "balance", "credit", "deposit", "withdraw"]
        
        if any(pending in order_type for pending in pending_types):
            return False
        
        return True
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """פענח שורה מ-MT4"""
        
        # דלג על שורות שאינן עסקאות
        if not self._is_trading_row(row):
            return None
        
        # Ticket ID
        ticket_raw = row.get("ticket", row.get("Ticket", ""))
        broker_trade_id = str(ticket_raw).strip() if pd.notna(ticket_raw) else None
        
        # Symbol
        symbol = str(row.get("symbol", row.get("Symbol", ""))).strip()
        if not symbol:
            raise ValueError("Symbol is required")
        
        # Direction
        direction_raw = row.get("direction", row.get("Type", ""))
        if pd.isna(direction_raw):
            raise ValueError("Order type is required")
        
        direction_str = self._parse_mt_direction(direction_raw)
        direction = TradeDirection(direction_str)
        
        # Quantity (lots)
        quantity_raw = row.get("quantity", row.get("Size", row.get("Volume", 0)))
        quantity = self._parse_decimal(quantity_raw)
        
        if quantity <= 0:
            raise ValueError(f"Invalid quantity: {quantity}")
        
        # Entry time & price
        entry_time = self._parse_datetime(
            row.get("entry_time", row.get("Open Time", ""))
        )
        entry_price = self._parse_decimal(
            row.get("entry_price", row.get("Price", 0))
        )
        
        if entry_price <= 0:
            raise ValueError(f"Invalid entry price: {entry_price}")
        
        # Exit time & price (may be empty if trade is still open)
        exit_time = None
        exit_price = None
        status = TradeStatus.OPEN
        
        exit_time_raw = row.get("exit_time", row.get("Close Time", None))
        exit_price_raw = row.get("exit_price", row.get("Close Price", None))
        
        if pd.notna(exit_time_raw) and pd.notna(exit_price_raw):
            exit_time_str = str(exit_time_raw).strip()
            exit_price_val = self._parse_decimal(exit_price_raw)
            
            # בדוק שזה לא ערך ריק
            if exit_time_str and exit_price_val > 0:
                try:
                    exit_time = self._parse_datetime(exit_time_raw)
                    exit_price = exit_price_val
                    status = TradeStatus.CLOSED
                except ValueError:
                    pass  # השאר כעסקה פתוחה
        
        # Commission
        commission = Decimal("0")
        comm_raw = row.get("commission", row.get("Commission", 0))
        if pd.notna(comm_raw):
            commission = abs(Decimal(str(self._parse_decimal(comm_raw))))
        
        # Swap (MT4 specific - overnight fees)
        swap = Decimal("0")
        swap_raw = row.get("swap", row.get("Swap", 0))
        if pd.notna(swap_raw):
            swap = Decimal(str(self._parse_decimal(swap_raw)))
        
        # Total commission includes swap
        total_commission = commission + abs(swap)
        
        # Asset type
        asset_type = self._detect_asset_type(symbol)
        
        # Stop Loss & Take Profit (for reference)
        sl = None
        tp = None
        if pd.notna(row.get("stop_loss", row.get("S/L", None))):
            try:
                sl = self._parse_decimal(row.get("stop_loss", row.get("S/L")))
            except:
                pass
        if pd.notna(row.get("take_profit", row.get("T/P", None))):
            try:
                tp = self._parse_decimal(row.get("take_profit", row.get("T/P")))
            except:
                pass
        
        # Store raw data with SL/TP info
        raw_data = row.to_dict()
        raw_data["stop_loss"] = sl
        raw_data["take_profit"] = tp
        
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
            commission=total_commission,
            broker_trade_id=broker_trade_id,
            raw_data=raw_data
        )
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """בדיקת עמודות מותאמת ל-MT4"""
        df_columns = [col.lower() for col in df.columns]
        
        missing = []
        
        # Ticket/Position
        if not any(name in df_columns for name in ["ticket", "position"]):
            missing.append("Ticket")
        
        # Symbol
        if "symbol" not in df_columns:
            missing.append("Symbol")
        
        # Type
        if "type" not in df_columns:
            missing.append("Type")
        
        # Size/Volume
        if not any(name in df_columns for name in ["size", "volume", "lots"]):
            missing.append("Size")
        
        return missing


class MetaTrader5Parser(MetaTrader4Parser):
    """
    Parser לקבצי MetaTrader 5
    
    MT5 דומה ל-MT4 עם כמה הבדלים קטנים בפורמט
    """
    
    BROKER = Broker.METATRADER5
    
    DATETIME_FORMAT = "%Y.%m.%d %H:%M:%S"
    
    COLUMN_MAPPING = {
        **MetaTrader4Parser.COLUMN_MAPPING,
        "position": "ticket",
        "deal": "ticket",
        "volume": "quantity",
    }

