"""
Binance Parser
==============

Parser לקבצי Trade History מ-Binance.

Binance יוצא נתונים בפורמטים שונים:
1. Spot Trade History
2. Futures Trade History
3. P&L Analysis Export

פורמט Spot:
Date(UTC), Pair, Side, Price, Executed, Amount, Fee

פורמט Futures:
Date, Symbol, Side, Price, Quantity, Quote Quantity, Commission, Commission Asset, Realized Profit
"""

from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime
import pandas as pd
import re

from .base import BaseParser, ParserResult
from ..models.trade import Trade, TradeDirection, TradeStatus, AssetType, TradeCollection
from ..models.account import Broker


class BinanceParser(BaseParser):
    """
    Parser לקבצי Binance
    
    האתגר ב-Binance:
    - כל fill הוא שורה נפרדת
    - צריך לאגד fills לעסקה אחת
    - Futures ו-Spot הם פורמטים שונים
    """
    
    BROKER = Broker.BINANCE
    
    REQUIRED_COLUMNS = [
        "pair",  # או symbol
        "side",
        "price",
        "executed"  # או quantity
    ]
    
    COLUMN_MAPPING = {
        # Spot format
        "date(utc)": "datetime",
        "date": "datetime",
        "pair": "symbol",
        "side": "direction",
        "executed": "quantity",
        "amount": "value",
        "fee": "commission",
        
        # Futures format
        "symbol": "symbol",
        "quantity": "quantity",
        "quote quantity": "value",
        "commission": "commission",
        "commission asset": "commission_asset",
        "realized profit": "pnl",
    }
    
    def __init__(self, account_id: Optional[str] = None, aggregate_fills: bool = True):
        """
        Args:
            account_id: מזהה החשבון
            aggregate_fills: האם לאגד fills מרובים לעסקה אחת
        """
        super().__init__(account_id)
        self.aggregate_fills = aggregate_fills
    
    def _normalize_symbol(self, symbol: str) -> str:
        """נרמל סימול Binance"""
        # הסר רווחים ותווים מיותרים
        symbol = symbol.strip().upper()
        
        # הוסף / בין מטבעות אם חסר
        # BTCUSDT -> BTC/USDT
        quote_currencies = ["USDT", "BUSD", "BTC", "ETH", "BNB", "USD", "USDC"]
        
        for quote in quote_currencies:
            if symbol.endswith(quote) and "/" not in symbol:
                base = symbol[:-len(quote)]
                if len(base) >= 2:  # וודא שנשאר משהו
                    return f"{base}/{quote}"
        
        return symbol
    
    def _parse_binance_datetime(self, value: str) -> datetime:
        """פענח תאריך בפורמט Binance"""
        
        value_str = str(value).strip()
        
        # Binance timestamp formats
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        # נסה Unix timestamp (milliseconds)
        try:
            timestamp = int(value_str)
            if timestamp > 1e12:  # milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
        except (ValueError, OSError):
            pass
        
        # נסה pandas
        return pd.to_datetime(value_str).to_pydatetime()
    
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """פענח שורה מ-Binance"""
        
        # Symbol
        symbol_raw = row.get("symbol", row.get("Pair", ""))
        symbol = self._normalize_symbol(str(symbol_raw))
        
        if not symbol or symbol == "/":
            raise ValueError("Symbol is required")
        
        # Direction
        direction_raw = row.get("direction", row.get("Side", ""))
        direction_str = self._parse_direction(direction_raw)
        direction = TradeDirection(direction_str)
        
        # Time
        datetime_raw = row.get("datetime", row.get("Date(UTC)", row.get("Date", "")))
        trade_time = self._parse_binance_datetime(datetime_raw)
        
        # Price
        price = self._parse_decimal(row.get("price", row.get("Price", 0)))
        if price <= 0:
            raise ValueError(f"Invalid price: {price}")
        
        # Quantity
        quantity = self._parse_decimal(
            row.get("quantity", row.get("Executed", row.get("Quantity", 0)))
        )
        if quantity <= 0:
            raise ValueError(f"Invalid quantity: {quantity}")
        
        # Commission
        commission = Decimal("0")
        fee_raw = row.get("commission", row.get("Fee", 0))
        if pd.notna(fee_raw):
            try:
                # Fee might include currency symbol
                fee_str = str(fee_raw)
                fee_num = re.sub(r'[^0-9.-]', '', fee_str)
                if fee_num:
                    commission = abs(Decimal(fee_num))
            except:
                pass
        
        # Check for realized PnL (Futures)
        pnl = None
        pnl_raw = row.get("pnl", row.get("Realized Profit", None))
        if pd.notna(pnl_raw):
            try:
                pnl = self._parse_decimal(pnl_raw)
            except:
                pass
        
        # אם יש PnL, זו עסקה סגורה
        if pnl is not None:
            # חשב מחיר כניסה משוער
            if direction == TradeDirection.LONG:
                entry_price = price - (Decimal(str(pnl)) / Decimal(str(quantity)))
            else:
                entry_price = price + (Decimal(str(pnl)) / Decimal(str(quantity)))
            
            return Trade(
                symbol=symbol,
                direction=direction,
                status=TradeStatus.CLOSED,
                asset_type=AssetType.CRYPTO,
                entry_time=trade_time,
                exit_time=trade_time,
                entry_price=entry_price,
                exit_price=Decimal(str(price)),
                quantity=Decimal(str(quantity)),
                commission=commission,
                raw_data=row.to_dict()
            )
        else:
            # עסקה חלקית / fill
            return Trade(
                symbol=symbol,
                direction=direction,
                status=TradeStatus.OPEN,
                asset_type=AssetType.CRYPTO,
                entry_time=trade_time,
                entry_price=Decimal(str(price)),
                quantity=Decimal(str(quantity)),
                commission=commission,
                raw_data=row.to_dict()
            )
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """בדיקת עמודות מותאמת ל-Binance"""
        df_columns = [col.lower() for col in df.columns]
        
        missing = []
        
        # Symbol/Pair
        if not any(name in df_columns for name in ["pair", "symbol"]):
            missing.append("Pair/Symbol")
        
        # Side
        if "side" not in df_columns:
            missing.append("Side")
        
        # Price
        if "price" not in df_columns:
            missing.append("Price")
        
        # Quantity
        if not any(name in df_columns for name in ["executed", "quantity"]):
            missing.append("Executed/Quantity")
        
        return missing
    
    def _aggregate_fills(self, trades: List[Trade]) -> List[Trade]:
        """
        אגד fills מרובים לעסקאות
        
        Binance מחזיר fill נפרד לכל מחיר ביצוע.
        פונקציה זו מאגדת אותם לעסקה אחת.
        """
        if not trades:
            return []
        
        # קבץ לפי סימול, כיוון וחלון זמן (דקה)
        aggregated: Dict[str, Trade] = {}
        
        for trade in sorted(trades, key=lambda t: t.entry_time):
            # צור מפתח לקיבוץ
            time_bucket = trade.entry_time.replace(second=0, microsecond=0)
            key = f"{trade.symbol}_{trade.direction.value}_{time_bucket.isoformat()}"
            
            if key in aggregated:
                existing = aggregated[key]
                
                # חשב מחיר ממוצע משוקלל
                total_qty = existing.quantity + trade.quantity
                weighted_price = (
                    (existing.entry_price * existing.quantity) + 
                    (trade.entry_price * trade.quantity)
                ) / total_qty
                
                # עדכן את העסקה הקיימת
                aggregated[key] = Trade(
                    id=existing.id,
                    symbol=existing.symbol,
                    direction=existing.direction,
                    status=existing.status,
                    asset_type=existing.asset_type,
                    entry_time=existing.entry_time,  # הזמן הראשון
                    exit_time=trade.entry_time if existing.status == TradeStatus.CLOSED else None,
                    entry_price=weighted_price,
                    exit_price=existing.exit_price,
                    quantity=total_qty,
                    commission=existing.commission + trade.commission,
                    account_id=existing.account_id,
                    broker_name=existing.broker_name
                )
            else:
                aggregated[key] = trade
        
        return list(aggregated.values())
    
    def _parse_dataframe(
        self, 
        df: pd.DataFrame, 
        source_file: Optional[str] = None
    ) -> ParserResult:
        """פענח עם אגרגציה אופציונלית"""
        
        result = super()._parse_dataframe(df, source_file)
        
        if self.aggregate_fills and result.trades.trades:
            aggregated = self._aggregate_fills(result.trades.trades)
            result.trades = TradeCollection(
                trades=aggregated,
                source_file=source_file,
                broker_name=self.BROKER.value
            )
            result.add_warning(
                f"Aggregated {result.parsed_successfully} fills into "
                f"{len(aggregated)} trades"
            )
        
        return result

