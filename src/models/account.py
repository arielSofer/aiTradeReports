"""
Account & Broker Models
=======================
מודלים לניהול חשבונות וברוקרים
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class Broker(str, Enum):
    """ברוקרים נתמכים"""
    INTERACTIVE_BROKERS = "interactive_brokers"
    METATRADER4 = "metatrader4"
    METATRADER5 = "metatrader5"
    BINANCE = "binance"
    COINBASE = "coinbase"
    TRADOVATE = "tradovate"
    NINJA_TRADER = "ninja_trader"
    TOPSTEPX = "topstepx"  # TopstepX prop firm
    THINKORSWIM = "thinkorswim"
    WEBULL = "webull"
    ROBINHOOD = "robinhood"
    ETRADE = "etrade"
    TRADESTATION = "tradestation"
    GENERIC = "generic"  # פורמט CSV גנרי


class Account(BaseModel):
    """
    מודל חשבון מסחר
    
    משתמש יכול לחבר מספר חשבונות מברוקרים שונים
    """
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., min_length=1, description="שם החשבון (לזיהוי)")
    broker: Broker
    
    # מידע על החשבון (אופציונלי)
    account_number: Optional[str] = None
    currency: str = "USD"
    
    # יתרה התחלתית (לחישוב ביצועים יחסיים)
    initial_balance: Optional[Decimal] = None
    
    # סטטוס
    is_active: bool = True
    is_demo: bool = False
    
    # תאריכים
    created_at: datetime = Field(default_factory=datetime.now)
    last_sync: Optional[datetime] = None
    
    # הגדרות API (מוצפנות!)
    api_key_encrypted: Optional[str] = None
    api_secret_encrypted: Optional[str] = None
    
    # סטטיסטיקות מצטברות (מתעדכנות בכל סנכרון)
    total_trades: int = 0
    total_pnl: Decimal = Decimal("0")
    
    model_config = {
        "json_encoders": {
            Decimal: lambda v: float(v),
            datetime: lambda v: v.isoformat()
        }
    }
    
    def get_csv_format_hint(self) -> str:
        """
        מחזיר רמז על פורמט ה-CSV הצפוי מהברוקר
        
        שימושי להצגה למשתמש בזמן העלאת קובץ
        """
        hints = {
            Broker.INTERACTIVE_BROKERS: (
                "יצא את ה-Trades מ-Account Management. "
                "עמודות צפויות: Date/Time, Symbol, Quantity, Price, Comm/Fee..."
            ),
            Broker.METATRADER4: (
                "יצא את ה-Account History מהטרמינל. "
                "עמודות צפויות: Ticket, Open Time, Type, Size, Symbol, Price..."
            ),
            Broker.BINANCE: (
                "הורד את Trade History מה-Spot או Futures. "
                "עמודות צפויות: Date, Pair, Side, Price, Quantity, Fee..."
            ),
            Broker.GENERIC: (
                "השתמש בפורמט הגנרי שלנו עם עמודות: "
                "symbol, direction, entry_time, exit_time, entry_price, exit_price, quantity"
            )
        }
        return hints.get(self.broker, hints[Broker.GENERIC])

