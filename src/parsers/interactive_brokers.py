"""
Interactive Brokers Parser
==========================

Parser לקבצי CSV מ-Interactive Brokers (IB).

הפורמט של IB מורכב יחסית:
- כולל שורות header מרובות
- עסקאות פתיחה וסגירה בשורות נפרדות
- צריך לחבר בין קניות למכירות לפי Symbol ותאריך

דוגמה לפורמט IB Flex:
Statement,Header,TradeConfirm,Data,Trades,Header
...
Trades,Data,Order,U1234567,EUR.USD,CASH,20240115,20240115 10:30:00,EUR,-50000,...
"""

from typing import Optional, Dict, List, Tuple
from decimal import Decimal
from datetime import datetime
import pandas as pd
import re

from .base import BaseParser, ParserResult
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType, TradeCollection
from ..models.account import Broker


class InteractiveBrokersParser(BaseParser):
    """
    Parser לקבצי Trades Export מ-Interactive Brokers
    
    תומך בשני פורמטים:
    1. Flex Query Export (XML/CSV מפורט)
    2. Activity Statement Export (CSV פשוט יותר)
    
    האתגר ב-IB: קניה ומכירה הם שורות נפרדות.
    ה-Parser מזהה זוגות ומחבר אותם לעסקה אחת.
    """
    
    BROKER = Broker.INTERACTIVE_BROKERS
    
    # עמודות נפוצות ב-IB exports
    REQUIRED_COLUMNS = [
        "symbol",
        "quantity"  # או Qty
    ]
    
    COLUMN_MAPPING = {
        # IB Flex format
        "conid": "contract_id",
        "underlyingsymbol": "symbol",
        "tradeprice": "price",
        "tradedate": "date",
        "tradetime": "time",
        "datetime": "datetime",
        "buysell": "direction",
        "ibcommission": "commission",
        "ibtradeid": "broker_trade_id",
        
        # Activity Statement format
        "date/time": "datetime",
        "comm/fee": "commission",
        "t. price": "price",
        "realized p/l": "pnl",
    }
    
    DATETIME_FORMAT = "%Y%m%d %H:%M:%S"
    
    def __init__(self, account_id: Optional[str] = None):
        super().__init__(account_id)
        # מאגר זמני לעסקאות פתוחות (ממתינות לזיווג)
        self._pending_trades: Dict[str, List[dict]] = {}
    
    def _normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """נקה ונרמל את הנתונים של IB"""
        
        # הסר שורות header פנימיות (IB כולל headers מרובים)
        if "Header" in df.columns:
            df = df[df["Header"] != "Header"]
        
        # IB לפעמים שם את הכותרות בתוך הנתונים
        # בדוק אם השורה הראשונה נראית כמו header
        first_row = df.iloc[0] if len(df) > 0 else None
        if first_row is not None:
            # אם כל הערכים בשורה הראשונה הם strings שנראים כמו headers
            if all(isinstance(v, str) and not any(c.isdigit() for c in str(v)) 
                   for v in first_row.values if pd.notna(v)):
                # השתמש בשורה הראשונה כ-headers
                df.columns = df.iloc[0]
                df = df[1:]
        
        return df.reset_index(drop=True)
    
    def _detect_asset_type(self, row: pd.Series) -> AssetType:
        """זהה סוג הנכס לפי המידע מ-IB"""
        
        asset_category = str(row.get("AssetClass", row.get("asset_class", ""))).upper()
        
        if asset_category == "STK":
            return AssetType.STOCK
        elif asset_category == "OPT":
            return AssetType.OPTION
        elif asset_category == "FUT":
            return AssetType.FUTURE
        elif asset_category == "CASH" or asset_category == "FX":
            return AssetType.FOREX
        elif asset_category == "CRYPTO":
            return AssetType.CRYPTO
        elif asset_category == "CFD":
            return AssetType.CFD
        
        return AssetType.STOCK  # ברירת מחדל
    
    def _parse_ib_datetime(self, row: pd.Series) -> datetime:
        """פענח תאריך ושעה בפורמט IB"""
        
        # נסה קודם datetime משולב
        if pd.notna(row.get("datetime")):
            return self._parse_datetime(row.get("datetime"))
        
        # אם יש date ו-time נפרדים
        if pd.notna(row.get("date")) and pd.notna(row.get("time")):
            date_str = str(row.get("date"))
            time_str = str(row.get("time"))
            combined = f"{date_str} {time_str}"
            return self._parse_datetime(combined)
        
        # IB Flex format: TradeDate + TradeTime
        if pd.notna(row.get("TradeDate")):
            date_str = str(row.get("TradeDate"))
            time_str = str(row.get("TradeTime", "00:00:00"))
            
            # פורמט: YYYYMMDD
            if len(date_str) == 8 and date_str.isdigit():
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            
            combined = f"{date_str} {time_str}"
            return self._parse_datetime(combined)
        
        raise ValueError("Could not find date/time in row")
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """
        פענח שורה מ-IB
        
        ב-IB כל שורה היא פעולה בודדת (קניה או מכירה).
        אם יש רק קניה - זו עסקה פתוחה.
        אם יש P&L ב-Realized P/L - זו עסקה סגורה.
        """
        
        symbol = str(row.get("symbol", row.get("Symbol", ""))).strip()
        if not symbol:
            return None
        
        # נקה סימולים (IB מוסיף לפעמים exchange suffix)
        symbol = symbol.split()[0]  # "AAPL NASDAQ" -> "AAPL"
        
        # כמות - IB משתמש בערכים שליליים למכירה
        quantity_raw = row.get("quantity", row.get("Quantity", row.get("Qty", 0)))
        quantity = self._parse_decimal(quantity_raw)
        
        if quantity == 0:
            return None
        
        # כיוון לפי סימן הכמות או עמודת Buy/Sell
        direction_raw = row.get("direction", row.get("Buy/Sell", ""))
        if pd.notna(direction_raw) and str(direction_raw).strip():
            direction_str = self._parse_direction(direction_raw)
        else:
            direction_str = "long" if quantity > 0 else "short"
        
        quantity = abs(quantity)
        direction = TradeDirection(direction_str)
        
        # מחיר
        price_raw = row.get("price", row.get("Price", row.get("T. Price", 0)))
        price = self._parse_decimal(price_raw)
        
        if price <= 0:
            raise ValueError(f"Invalid price: {price}")
        
        # זמן
        trade_time = self._parse_ib_datetime(row)
        
        # עמלה
        commission = Decimal("0")
        comm_raw = row.get("commission", row.get("Comm/Fee", 0))
        if pd.notna(comm_raw):
            commission = abs(Decimal(str(self._parse_decimal(comm_raw))))
        
        # בדוק אם יש P&L (עסקה סגורה)
        pnl = None
        pnl_raw = row.get("pnl", row.get("Realized P/L", row.get("RealizedPnL", None)))
        if pd.notna(pnl_raw):
            pnl = self._parse_decimal(pnl_raw)
        
        # סוג נכס
        asset_type = self._detect_asset_type(row)
        
        # ID מקורי
        broker_trade_id = None
        if pd.notna(row.get("broker_trade_id", row.get("IBTradeID", None))):
            broker_trade_id = str(row.get("broker_trade_id", row.get("IBTradeID")))
        
        # אם יש P&L, זו עסקה שנסגרה
        if pnl is not None and pnl != 0:
            # חשב מחיר כניסה משוער מה-P&L
            # P&L = (exit - entry) * qty  =>  entry = exit - (P&L / qty)
            if direction == TradeDirection.LONG:
                entry_price = price - (Decimal(str(pnl)) / Decimal(str(quantity)))
            else:
                entry_price = price + (Decimal(str(pnl)) / Decimal(str(quantity)))
            
            return Trade(
                symbol=symbol,
                direction=direction,
                status=TradeStatus.CLOSED,
                asset_type=asset_type,
                entry_time=trade_time,  # IB לא נותן זמן כניסה נפרד
                exit_time=trade_time,
                entry_price=entry_price,
                exit_price=Decimal(str(price)),
                quantity=Decimal(str(quantity)),
                commission=commission,
                broker_trade_id=broker_trade_id,
                raw_data=row.to_dict()
            )
        else:
            # עסקה פתוחה או חלקית
            return Trade(
                symbol=symbol,
                direction=direction,
                status=TradeStatus.OPEN,
                asset_type=asset_type,
                entry_time=trade_time,
                entry_price=Decimal(str(price)),
                quantity=Decimal(str(quantity)),
                commission=commission,
                broker_trade_id=broker_trade_id,
                raw_data=row.to_dict()
            )
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """
        בדיקת עמודות מותאמת ל-IB
        
        IB יכול להשתמש בשמות עמודות שונים
        """
        df_columns = [col.lower() for col in df.columns]
        
        # Symbol יכול להיות Symbol, UnderlyingSymbol, או אחרים
        has_symbol = any(
            name in df_columns 
            for name in ["symbol", "underlyingsymbol", "underlying symbol"]
        )
        
        # Quantity יכול להיות Quantity, Qty
        has_quantity = any(
            name in df_columns 
            for name in ["quantity", "qty"]
        )
        
        missing = []
        if not has_symbol:
            missing.append("Symbol")
        if not has_quantity:
            missing.append("Quantity")
        
        return missing

