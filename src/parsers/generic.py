"""
Generic CSV Parser
==================

Parser לפורמט CSV גנרי.
זהו הפורמט הפשוט ביותר שמשתמשים יכולים להכין ידנית.

פורמט צפוי:
symbol, direction, entry_time, exit_time, entry_price, exit_price, quantity, commission
AAPL, long, 2024-01-15 10:30:00, 2024-01-15 14:45:00, 150.50, 152.30, 100, 2.00
"""

from typing import Optional
from decimal import Decimal
import pandas as pd

from .base import BaseParser
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType
from ..models.account import Broker


class GenericCSVParser(BaseParser):
    """
    Parser לפורמט CSV גנרי
    
    עמודות נדרשות:
    - symbol: סימול הנכס
    - direction: כיוון (buy/sell או long/short)
    - entry_time: זמן כניסה
    - entry_price: מחיר כניסה
    - quantity: כמות
    
    עמודות אופציונליות:
    - exit_time: זמן יציאה
    - exit_price: מחיר יציאה
    - commission: עמלות
    - asset_type: סוג נכס (stock/option/future/forex/crypto)
    - tags: תגיות (מופרדות בפסיק)
    - notes: הערות
    """
    
    BROKER = Broker.GENERIC
    
    REQUIRED_COLUMNS = [
        "symbol",
        "direction",
        "entry_time",
        "entry_price",
        "quantity"
    ]
    
    # מיפוי שמות עמודות אלטרנטיביים
    COLUMN_MAPPING = {
        # Symbol variants
        "ticker": "symbol",
        "instrument": "symbol",
        "asset": "symbol",
        "pair": "symbol",
        
        # Direction variants
        "side": "direction",
        "type": "direction",
        "action": "direction",
        "position": "direction",
        
        # Time variants
        "open_time": "entry_time",
        "entry_date": "entry_time",
        "open_date": "entry_time",
        "close_time": "exit_time",
        "exit_date": "exit_time",
        "close_date": "exit_time",
        
        # Price variants
        "open_price": "entry_price",
        "close_price": "exit_price",
        "buy_price": "entry_price",
        "sell_price": "exit_price",
        
        # Quantity variants
        "size": "quantity",
        "volume": "quantity",
        "lots": "quantity",
        "amount": "quantity",
        "shares": "quantity",
        "contracts": "quantity",
        
        # Commission variants
        "fee": "commission",
        "fees": "commission",
        "cost": "commission",
    }
    
    DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """פענח שורה לעסקה"""
        
        # שדות חובה
        symbol = str(row.get("symbol", "")).strip()
        if not symbol:
            raise ValueError("Symbol is required")
        
        direction_raw = row.get("direction")
        direction_str = self._parse_direction(direction_raw)
        direction = TradeDirection(direction_str)
        
        entry_time = self._parse_datetime(row.get("entry_time"))
        entry_price = self._parse_decimal(row.get("entry_price"), allow_negative=False)
        quantity = self._parse_decimal(row.get("quantity"), allow_negative=False)
        
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if entry_price <= 0:
            raise ValueError("Entry price must be positive")
        
        # שדות אופציונליים
        exit_time = None
        exit_price = None
        status = TradeStatus.OPEN
        
        if pd.notna(row.get("exit_time")) and pd.notna(row.get("exit_price")):
            exit_time = self._parse_datetime(row.get("exit_time"))
            exit_price = self._parse_decimal(row.get("exit_price"), allow_negative=False)
            status = TradeStatus.CLOSED
            
            # וידוא שזמן היציאה אחרי זמן הכניסה
            if exit_time < entry_time:
                raise ValueError("Exit time cannot be before entry time")
        
        commission = Decimal("0")
        if pd.notna(row.get("commission")):
            commission = Decimal(str(self._parse_decimal(row.get("commission"))))
        
        # סוג נכס
        asset_type = AssetType.STOCK
        if pd.notna(row.get("asset_type")):
            try:
                asset_type = AssetType(str(row.get("asset_type")).lower())
            except ValueError:
                pass  # השאר ברירת מחדל
        
        # תגיות
        tags = []
        if pd.notna(row.get("tags")):
            tags_str = str(row.get("tags"))
            tags = [t.strip().lower() for t in tags_str.split(",") if t.strip()]
        
        # הערות
        notes = None
        if pd.notna(row.get("notes")):
            notes = str(row.get("notes")).strip()
        
        # שמור את הנתונים הגולמיים
        raw_data = row.to_dict()
        # נקה NaN values
        raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
        
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
            tags=tags,
            notes=notes,
            raw_data=raw_data
        )

