"""
Tradovate Parser
================

Parser לקבצי Trade History מ-Tradovate.

Tradovate היא פלטפורמה פופולרית לסחר בחוזים עתידיים.
הפלטפורמה מאפשרת ייצוא היסטוריית עסקאות בפורמט CSV.

פורמט Tradovate Trade History:
orderId,accountId,contractId,timestamp,action,ordStatus,ordType,
price,triggerPrice,qty,filledQty,avgFillPrice,text

או פורמט Trade Breakdown:
Date,Contract,B/S,Qty,Price,P&L,Cumulative P&L,Commission

דוגמה:
2024-01-15 10:30:00,ESH4,Buy,1,4850.25,,,
2024-01-15 11:45:00,ESH4,Sell,1,4855.50,262.50,262.50,4.04
"""

from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime
import pandas as pd
import re

from .base import BaseParser, ParserResult
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType, TradeCollection
from ..models.account import Broker


class TradovateParser(BaseParser):
    """
    Parser לקבצי Tradovate
    
    Tradovate יוצא שני סוגי קבצים:
    1. Order History - כל פעולה בנפרד
    2. Trade Breakdown - עסקאות מסוכמות
    
    ה-Parser מזהה את הפורמט אוטומטית.
    """
    
    BROKER = Broker.TRADOVATE
    
    REQUIRED_COLUMNS = [
        "contract",  # או contractId
    ]
    
    COLUMN_MAPPING = {
        # Trade Breakdown format
        "date": "datetime",
        "contract": "symbol",
        "b/s": "direction",
        "buy/sell": "direction",
        "qty": "quantity",
        "price": "price",
        "p&l": "pnl",
        "cumulative p&l": "cumulative_pnl",
        "commission": "commission",
        
        # Order History format
        "orderid": "order_id",
        "accountid": "account",
        "contractid": "symbol",
        "timestamp": "datetime",
        "action": "direction",
        "ordstatus": "status",
        "ordtype": "order_type",
        "filledqty": "quantity",
        "avgfillprice": "price",
    }
    
    DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"
    
    def __init__(self, account_id: Optional[str] = None):
        super().__init__(account_id)
        self._pending_trades: Dict[str, dict] = {}
    
    def _normalize_symbol(self, symbol: str) -> str:
        """
        נרמל סימול Tradovate
        
        ESH4 -> ES (H = March, 4 = 2024)
        MNQZ3 -> MNQ
        """
        symbol = str(symbol).strip().upper()
        
        # Futures contract pattern: BASE + MONTH_CODE + YEAR
        # Month codes: F,G,H,J,K,M,N,Q,U,V,X,Z
        futures_pattern = r'^([A-Z]{2,4})[FGHJKMNQUVXZ]\d{1,2}$'
        match = re.match(futures_pattern, symbol)
        if match:
            return match.group(1)
        
        return symbol
    
    def _detect_asset_type(self, symbol: str) -> AssetType:
        """זהה סוג נכס"""
        
        base_symbol = self._normalize_symbol(symbol)
        
        # Tradovate בעיקר לעתידיים
        futures_symbols = [
            "ES", "NQ", "YM", "RTY",  # E-mini Index
            "MES", "MNQ", "MYM", "M2K",  # Micro E-mini
            "CL", "GC", "SI", "NG", "HG",  # Commodities
            "6E", "6J", "6B", "6A", "6C",  # Currencies
            "ZB", "ZN", "ZF", "ZT",  # Treasuries
        ]
        
        if base_symbol in futures_symbols:
            return AssetType.FUTURE
        
        return AssetType.FUTURE
    
    def _parse_tradovate_datetime(self, value: str) -> datetime:
        """פענח תאריך בפורמט Tradovate"""
        
        value_str = str(value).strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%m/%d/%Y %H:%M:%S",
            "%Y-%m-%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        return pd.to_datetime(value_str).to_pydatetime()
    
    def _detect_format(self, df: pd.DataFrame) -> str:
        """זהה פורמט הקובץ"""
        columns_lower = [c.lower() for c in df.columns]
        
        if "b/s" in columns_lower or "buy/sell" in columns_lower:
            return "trade_breakdown"
        elif "action" in columns_lower or "ordstatus" in columns_lower:
            return "order_history"
        else:
            return "trade_breakdown"  # ברירת מחדל
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """פענח שורה מ-Tradovate (Trade Breakdown format)"""
        
        # Symbol
        symbol_raw = row.get("symbol", row.get("Contract", ""))
        if pd.isna(symbol_raw) or not str(symbol_raw).strip():
            return None
        
        symbol = self._normalize_symbol(str(symbol_raw))
        
        # Direction
        direction_raw = row.get("direction", row.get("B/S", row.get("Action", "")))
        if pd.isna(direction_raw):
            return None
        
        direction_str = str(direction_raw).lower().strip()
        if direction_str in ["buy", "b", "long"]:
            direction = TradeDirection.LONG
        elif direction_str in ["sell", "s", "short"]:
            direction = TradeDirection.SHORT
        else:
            # זה יכול להיות סגירה - נטפל בזה בהמשך
            return None
        
        # Quantity
        quantity_raw = row.get("quantity", row.get("Qty", 1))
        quantity = abs(self._parse_decimal(quantity_raw))
        if quantity <= 0:
            return None
        
        # Price
        price_raw = row.get("price", row.get("Price", row.get("avgfillprice", 0)))
        price = self._parse_decimal(price_raw)
        if price <= 0:
            raise ValueError(f"Invalid price: {price}")
        
        # Time
        datetime_raw = row.get("datetime", row.get("Date", row.get("timestamp", "")))
        trade_time = self._parse_tradovate_datetime(datetime_raw)
        
        # P&L (if available - means trade is closed)
        pnl = None
        pnl_raw = row.get("pnl", row.get("P&L", None))
        if pd.notna(pnl_raw) and str(pnl_raw).strip():
            try:
                pnl = self._parse_decimal(pnl_raw)
            except:
                pass
        
        # Commission
        commission = Decimal("0")
        comm_raw = row.get("commission", row.get("Commission", 0))
        if pd.notna(comm_raw):
            try:
                commission = abs(Decimal(str(self._parse_decimal(comm_raw))))
            except:
                pass
        
        # Status and exit info
        status = TradeStatus.OPEN
        exit_time = None
        exit_price = None
        
        if pnl is not None:
            # אם יש P&L, זו עסקה סגורה
            status = TradeStatus.CLOSED
            exit_time = trade_time  # Trade Breakdown מציג את זמן הסגירה
            exit_price = Decimal(str(price))
            
            # חשב מחיר כניסה מה-P&L
            if direction == TradeDirection.LONG:
                entry_price = exit_price - (Decimal(str(pnl)) / Decimal(str(quantity)))
            else:
                entry_price = exit_price + (Decimal(str(pnl)) / Decimal(str(quantity)))
        else:
            entry_price = Decimal(str(price))
        
        # Asset type
        asset_type = self._detect_asset_type(symbol_raw)
        
        return Trade(
            symbol=symbol,
            direction=direction,
            status=status,
            asset_type=asset_type,
            entry_time=trade_time if status == TradeStatus.OPEN else trade_time,
            exit_time=exit_time,
            entry_price=entry_price if status == TradeStatus.OPEN else entry_price,
            exit_price=exit_price,
            quantity=Decimal(str(quantity)),
            commission=commission,
            raw_data=row.to_dict()
        )
    
    def _parse_dataframe(
        self, 
        df: pd.DataFrame, 
        source_file: Optional[str] = None
    ) -> ParserResult:
        """פענח עם זיהוי פורמט אוטומטי"""
        
        format_type = self._detect_format(df)
        
        if format_type == "order_history":
            return self._parse_order_history(df, source_file)
        else:
            return super()._parse_dataframe(df, source_file)
    
    def _parse_order_history(
        self, 
        df: pd.DataFrame, 
        source_file: Optional[str] = None
    ) -> ParserResult:
        """
        פענח Order History format
        
        בפורמט זה צריך לחבר בין פקודות קניה ומכירה
        """
        result = ParserResult(
            trades=TradeCollection(
                source_file=source_file,
                broker_name=self.BROKER.value
            ),
            total_rows=len(df)
        )
        
        # קבץ לפי symbol
        open_positions: Dict[str, List[dict]] = {}
        
        df = self._apply_column_mapping(df)
        
        for idx, row in df.iterrows():
            row_num = idx + 2
            
            try:
                symbol_raw = row.get("symbol", "")
                if pd.isna(symbol_raw):
                    continue
                
                symbol = self._normalize_symbol(str(symbol_raw))
                action = str(row.get("direction", row.get("action", ""))).lower()
                
                if "buy" in action:
                    direction = "long"
                elif "sell" in action:
                    direction = "short"
                else:
                    continue
                
                quantity = abs(self._parse_decimal(row.get("quantity", row.get("filledqty", 1))))
                price = self._parse_decimal(row.get("price", row.get("avgfillprice", 0)))
                
                if price <= 0 or quantity <= 0:
                    continue
                
                trade_time = self._parse_tradovate_datetime(
                    row.get("datetime", row.get("timestamp", ""))
                )
                
                commission = Decimal("0")
                if pd.notna(row.get("commission")):
                    commission = Decimal(str(self._parse_decimal(row.get("commission"))))
                
                key = f"{symbol}_{direction}"
                
                if key not in open_positions:
                    open_positions[key] = []
                
                open_positions[key].append({
                    "time": trade_time,
                    "price": price,
                    "quantity": quantity,
                    "commission": commission,
                    "direction": direction,
                    "symbol": symbol,
                    "raw": row.to_dict()
                })
                
            except Exception as e:
                result.add_error(row_num, str(e))
        
        # צור עסקאות מזוגות
        for key, fills in open_positions.items():
            if len(fills) < 2:
                # עסקה פתוחה
                fill = fills[0]
                trade = Trade(
                    symbol=fill["symbol"],
                    direction=TradeDirection(fill["direction"]),
                    status=TradeStatus.OPEN,
                    asset_type=self._detect_asset_type(fill["symbol"]),
                    entry_time=fill["time"],
                    entry_price=Decimal(str(fill["price"])),
                    quantity=Decimal(str(fill["quantity"])),
                    commission=fill["commission"],
                    raw_data=fill["raw"]
                )
                result.trades.trades.append(trade)
                result.parsed_successfully += 1
            else:
                # זווג fills
                fills.sort(key=lambda x: x["time"])
                
                for i in range(0, len(fills) - 1, 2):
                    entry = fills[i]
                    exit_fill = fills[i + 1] if i + 1 < len(fills) else None
                    
                    if exit_fill:
                        trade = Trade(
                            symbol=entry["symbol"],
                            direction=TradeDirection(entry["direction"]),
                            status=TradeStatus.CLOSED,
                            asset_type=self._detect_asset_type(entry["symbol"]),
                            entry_time=entry["time"],
                            exit_time=exit_fill["time"],
                            entry_price=Decimal(str(entry["price"])),
                            exit_price=Decimal(str(exit_fill["price"])),
                            quantity=Decimal(str(entry["quantity"])),
                            commission=entry["commission"] + exit_fill["commission"],
                            raw_data={"entry": entry["raw"], "exit": exit_fill["raw"]}
                        )
                        trade.calculate_pnl() if hasattr(trade, 'calculate_pnl') else None
                    else:
                        trade = Trade(
                            symbol=entry["symbol"],
                            direction=TradeDirection(entry["direction"]),
                            status=TradeStatus.OPEN,
                            asset_type=self._detect_asset_type(entry["symbol"]),
                            entry_time=entry["time"],
                            entry_price=Decimal(str(entry["price"])),
                            quantity=Decimal(str(entry["quantity"])),
                            commission=entry["commission"],
                            raw_data=entry["raw"]
                        )
                    
                    result.trades.trades.append(trade)
                    result.parsed_successfully += 1
        
        return result
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """בדיקת עמודות מותאמת ל-Tradovate"""
        df_columns = [col.lower() for col in df.columns]
        
        missing = []
        
        # Contract
        if not any(name in df_columns for name in ["contract", "contractid", "symbol"]):
            missing.append("Contract")
        
        return missing

