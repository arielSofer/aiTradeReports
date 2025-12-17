"""
Unified Trade Model - הלב של המערכת
====================================
מודל נתונים אחיד שמייצג עסקה מכל ברוקר בפורמט סטנדרטי.

כל Parser של ברוקר ספציפי ממיר את הפורמט שלו למודל זה.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, computed_field, field_validator
import uuid


class TradeDirection(str, Enum):
    """כיוון העסקה - לונג או שורט"""
    LONG = "long"
    SHORT = "short"


class TradeStatus(str, Enum):
    """סטטוס העסקה"""
    OPEN = "open"
    CLOSED = "closed"
    PARTIAL = "partial"  # סגירה חלקית


class AssetType(str, Enum):
    """סוג הנכס הנסחר"""
    STOCK = "stock"
    OPTION = "option"
    FUTURE = "future"
    FOREX = "forex"
    CRYPTO = "crypto"
    CFD = "cfd"
    OTHER = "other"


class Trade(BaseModel):
    """
    מודל עסקה אחיד - Unified Trade Model
    
    כל עסקה מכל ברוקר תומר למודל זה.
    זה מאפשר ניתוח אחיד ללא תלות במקור הנתונים.
    
    Attributes:
        id: מזהה ייחודי לעסקה
        symbol: סימול הנכס (e.g., AAPL, BTCUSD)
        direction: כיוון - Long או Short
        entry_time: זמן הכניסה לעסקה
        exit_time: זמן היציאה (None אם עדיין פתוחה)
        entry_price: מחיר הכניסה הממוצע
        exit_price: מחיר היציאה הממוצע
        quantity: כמות (יחידות/לוטים/חוזים)
        commission: עמלות מצטברות
        tags: תגיות שהמשתמש מוסיף (e.g., "FOMO", "Revenge Trade")
        notes: הערות חופשיות
        broker_trade_id: מזהה מקורי מהברוקר
    """
    
    # מזהים
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    broker_trade_id: Optional[str] = None
    
    # מידע בסיסי על הנכס
    symbol: str = Field(..., min_length=1, description="סימול הנכס")
    asset_type: AssetType = AssetType.STOCK
    
    # כיוון וסטטוס
    direction: TradeDirection
    status: TradeStatus = TradeStatus.CLOSED
    
    # תזמון
    entry_time: datetime
    exit_time: Optional[datetime] = None
    
    # מחירים
    entry_price: Decimal = Field(..., gt=0)
    exit_price: Optional[Decimal] = Field(default=None, gt=0)
    
    # כמות ועמלות
    quantity: Decimal = Field(..., gt=0)
    commission: Decimal = Field(default=Decimal("0"))
    
    # מטא-דאטה
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    
    # שדה לעקיפת חישוב PnL (למשל בחוזים עתידיים עם מכפיל)
    override_pnl: Optional[Decimal] = None
    
    # מידע על החשבון והברוקר
    account_id: Optional[str] = None
    broker_name: Optional[str] = None
    
    # מידע גולמי מקורי (לשמירה)
    raw_data: Optional[Dict[str, Any]] = None
    
    model_config = {
        "json_encoders": {
            Decimal: lambda v: float(v),
            datetime: lambda v: v.isoformat()
        }
    }
    
    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, v: str) -> str:
        """נרמל את הסימול - אותיות גדולות, ללא רווחים"""
        return v.strip().upper()
    
    @field_validator("entry_price", "exit_price", "quantity", "commission", "override_pnl", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        """המר מספרים ל-Decimal לדיוק מקסימלי"""
        if v is None:
            return v
        if isinstance(v, Decimal):
            return v
        return Decimal(str(v))
    
    @computed_field
    @property
    def pnl_gross(self) -> Optional[Decimal]:
        """
        רווח/הפסד גולמי (לפני עמלות)
        
        אם יש overrid_pnl, נשתמש בו (למשל עבור חוזים עתידיים).
        אחרת:
        Long: (exit - entry) * quantity
        Short: (entry - exit) * quantity
        """
        if self.override_pnl is not None:
            return self.override_pnl
            
        if self.exit_price is None:
            return None
        
        if self.direction == TradeDirection.LONG:
            return (self.exit_price - self.entry_price) * self.quantity
        else:  # SHORT
            return (self.entry_price - self.exit_price) * self.quantity
    
    @computed_field
    @property
    def pnl_net(self) -> Optional[Decimal]:
        """רווח/הפסד נקי (אחרי עמלות)"""
        if self.pnl_gross is None:
            return None
        return self.pnl_gross - self.commission
    
    @computed_field
    @property
    def pnl_percent(self) -> Optional[float]:
        """אחוז רווח/הפסד יחסית להשקעה"""
        if self.pnl_gross is None:
            return None
        investment = self.entry_price * self.quantity
        if investment == 0:
            return 0.0
        return float((self.pnl_gross / investment) * 100)
    
    @computed_field
    @property
    def r_multiple(self) -> Optional[float]:
        """
        R-Multiple - מדד סיכון/תשואה
        
        אם המשתמש מגדיר stop loss, זה יחושב כ:
        R = PnL / Risk (כאשר Risk = מרחק ל-SL)
        
        כרגע מחזיר None - יחושב כשיתווסף stop_loss למודל
        """
        # TODO: הוסף שדה stop_loss וחשב R-Multiple
        return None
    
    @computed_field
    @property
    def duration_minutes(self) -> Optional[int]:
        """משך העסקה בדקות"""
        if self.exit_time is None:
            return None
        delta = self.exit_time - self.entry_time
        return int(delta.total_seconds() / 60)
    
    @computed_field
    @property
    def is_winner(self) -> Optional[bool]:
        """האם העסקה רווחית?"""
        if self.pnl_net is None:
            return None
        return self.pnl_net > 0
    
    def add_tag(self, tag: str) -> None:
        """הוסף תגית לעסקה"""
        normalized_tag = tag.strip().lower()
        if normalized_tag and normalized_tag not in self.tags:
            self.tags.append(normalized_tag)
    
    def remove_tag(self, tag: str) -> None:
        """הסר תגית מהעסקה"""
        normalized_tag = tag.strip().lower()
        if normalized_tag in self.tags:
            self.tags.remove(normalized_tag)
    
    def to_chart_format(self) -> Dict[str, Any]:
        """
        המר לפורמט מוכן להצגה בגרף
        
        מחזיר dict עם המידע הנדרש ל-TradingView Lightweight Charts
        """
        return {
            "symbol": self.symbol,
            "entryTime": int(self.entry_time.timestamp()),
            "exitTime": int(self.exit_time.timestamp()) if self.exit_time else None,
            "entryPrice": float(self.entry_price),
            "exitPrice": float(self.exit_price) if self.exit_price else None,
            "direction": self.direction.value,
            "quantity": float(self.quantity),
            "pnl": float(self.pnl_net) if self.pnl_net else None,
            "pnlPercent": self.pnl_percent,
            "isWinner": self.is_winner,
            "tags": self.tags,
            "markers": [
                {
                    "time": int(self.entry_time.timestamp()),
                    "position": "belowBar" if self.direction == TradeDirection.LONG else "aboveBar",
                    "color": "#2196F3",
                    "shape": "arrowUp" if self.direction == TradeDirection.LONG else "arrowDown",
                    "text": f"Entry @ {float(self.entry_price):.2f}"
                }
            ] + ([
                {
                    "time": int(self.exit_time.timestamp()),
                    "position": "aboveBar" if self.direction == TradeDirection.LONG else "belowBar",
                    "color": "#4CAF50" if self.is_winner else "#F44336",
                    "shape": "arrowDown" if self.direction == TradeDirection.LONG else "arrowUp",
                    "text": f"Exit @ {float(self.exit_price):.2f}"
                }
            ] if self.exit_time and self.exit_price else [])
        }


class TradeCollection(BaseModel):
    """
    אוסף עסקאות עם מטריקות מצטברות
    
    משמש לייצוג תיק עסקאות שהתקבל מקובץ CSV או API
    """
    
    trades: List[Trade] = Field(default_factory=list)
    source_file: Optional[str] = None
    broker_name: Optional[str] = None
    import_time: datetime = Field(default_factory=datetime.now)
    
    @computed_field
    @property
    def total_trades(self) -> int:
        """סה"כ עסקאות"""
        return len(self.trades)
    
    @computed_field
    @property
    def winning_trades(self) -> int:
        """כמות עסקאות מנצחות"""
        return sum(1 for t in self.trades if t.is_winner is True)
    
    @computed_field
    @property
    def losing_trades(self) -> int:
        """כמות עסקאות מפסידות"""
        return sum(1 for t in self.trades if t.is_winner is False)
    
    @computed_field
    @property
    def win_rate(self) -> Optional[float]:
        """אחוז הצלחה"""
        closed = self.winning_trades + self.losing_trades
        if closed == 0:
            return None
        return (self.winning_trades / closed) * 100
    
    @computed_field
    @property
    def total_pnl(self) -> Decimal:
        """רווח/הפסד מצטבר"""
        return sum((t.pnl_net or Decimal("0")) for t in self.trades)
    
    @computed_field
    @property
    def total_commission(self) -> Decimal:
        """סה"כ עמלות"""
        return sum(t.commission for t in self.trades)
    
    @computed_field
    @property
    def avg_winner(self) -> Optional[Decimal]:
        """ממוצע עסקה מנצחת"""
        winners = [t.pnl_net for t in self.trades if t.is_winner and t.pnl_net]
        if not winners:
            return None
        return sum(winners) / len(winners)
    
    @computed_field
    @property
    def avg_loser(self) -> Optional[Decimal]:
        """ממוצע עסקה מפסידה (ערך מוחלט)"""
        losers = [abs(t.pnl_net) for t in self.trades if t.is_winner is False and t.pnl_net]
        if not losers:
            return None
        return sum(losers) / len(losers)
    
    @computed_field
    @property
    def profit_factor(self) -> Optional[float]:
        """
        Profit Factor - יחס בין סכום הרווחים לסכום ההפסדים
        
        > 1 = רווחי
        < 1 = מפסיד
        """
        gross_profit = sum(
            t.pnl_net for t in self.trades 
            if t.pnl_net and t.pnl_net > 0
        )
        gross_loss = abs(sum(
            t.pnl_net for t in self.trades 
            if t.pnl_net and t.pnl_net < 0
        ))
        
        if gross_loss == 0:
            return None if gross_profit == 0 else float("inf")
        
        return float(gross_profit / gross_loss)
    
    def filter_by_symbol(self, symbol: str) -> "TradeCollection":
        """סנן לפי סימול"""
        filtered = [t for t in self.trades if t.symbol == symbol.upper()]
        return TradeCollection(trades=filtered, broker_name=self.broker_name)
    
    def filter_by_date_range(
        self, 
        start: datetime, 
        end: datetime
    ) -> "TradeCollection":
        """סנן לפי טווח תאריכים"""
        filtered = [
            t for t in self.trades 
            if start <= t.entry_time <= end
        ]
        return TradeCollection(trades=filtered, broker_name=self.broker_name)
    
    def filter_by_tag(self, tag: str) -> "TradeCollection":
        """סנן לפי תגית"""
        normalized_tag = tag.strip().lower()
        filtered = [t for t in self.trades if normalized_tag in t.tags]
        return TradeCollection(trades=filtered, broker_name=self.broker_name)
    
    def get_daily_pnl(self) -> Dict[str, Decimal]:
        """חשב P&L יומי לגרף"""
        daily = {}
        for trade in self.trades:
            if trade.exit_time and trade.pnl_net:
                date_key = trade.exit_time.strftime("%Y-%m-%d")
                daily[date_key] = daily.get(date_key, Decimal("0")) + trade.pnl_net
        return dict(sorted(daily.items()))
    
    def get_hourly_performance(self) -> Dict[int, Dict[str, Any]]:
        """
        ביצועים לפי שעות ביום
        
        מחזיר dict עם מטריקות לכל שעה (0-23)
        שימושי לזיהוי שעות מסחר אופטימליות
        """
        hourly = {h: {"trades": 0, "wins": 0, "pnl": Decimal("0")} for h in range(24)}
        
        for trade in self.trades:
            hour = trade.entry_time.hour
            hourly[hour]["trades"] += 1
            if trade.is_winner:
                hourly[hour]["wins"] += 1
            if trade.pnl_net:
                hourly[hour]["pnl"] += trade.pnl_net
        
        # חשב win rate לכל שעה
        for h in hourly:
            trades = hourly[h]["trades"]
            hourly[h]["win_rate"] = (
                (hourly[h]["wins"] / trades * 100) if trades > 0 else None
            )
        
        return hourly
    
    def to_json(self) -> str:
        """המר לפורמט JSON"""
        import json
        return self.model_dump_json(indent=2)
    
    def to_dataframe(self):
        """המר ל-Pandas DataFrame לניתוח מתקדם"""
        import pandas as pd
        
        data = []
        for trade in self.trades:
            data.append({
                "id": trade.id,
                "symbol": trade.symbol,
                "direction": trade.direction.value,
                "entry_time": trade.entry_time,
                "exit_time": trade.exit_time,
                "entry_price": float(trade.entry_price),
                "exit_price": float(trade.exit_price) if trade.exit_price else None,
                "quantity": float(trade.quantity),
                "commission": float(trade.commission),
                "pnl_gross": float(trade.pnl_gross) if trade.pnl_gross else None,
                "pnl_net": float(trade.pnl_net) if trade.pnl_net else None,
                "pnl_percent": trade.pnl_percent,
                "is_winner": trade.is_winner,
                "duration_minutes": trade.duration_minutes,
                "tags": ",".join(trade.tags) if trade.tags else ""
            })
        
        return pd.DataFrame(data)





