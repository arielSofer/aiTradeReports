"""
Parser Factory
==============

Factory לבחירת ה-Parser המתאים אוטומטית.
מזהה את פורמט הקובץ ומחזיר את ה-Parser הנכון.
"""

from pathlib import Path
from typing import Optional, Type, Union
import pandas as pd
import io

from .base import BaseParser, ParserResult
from .generic import GenericCSVParser
from .interactive_brokers import InteractiveBrokersParser
from .metatrader import MetaTrader4Parser, MetaTrader5Parser
from .binance import BinanceParser
from .ninjatrader import NinjaTrader8Parser
from .tradovate import TradovateParser
from ..models.account import Broker


class ParserFactory:
    """
    Factory לזיהוי אוטומטי של פורמט הקובץ ובחירת Parser
    
    שימוש:
    ```python
    result = ParserFactory.parse_file("trades.csv")
    print(f"זוהה כ: {result.trades.broker_name}")
    print(f"נקלטו {result.parsed_successfully} עסקאות")
    ```
    """
    
    # מיפוי ברוקרים ל-Parsers
    PARSERS = {
        Broker.GENERIC: GenericCSVParser,
        Broker.INTERACTIVE_BROKERS: InteractiveBrokersParser,
        Broker.METATRADER4: MetaTrader4Parser,
        Broker.METATRADER5: MetaTrader5Parser,
        Broker.BINANCE: BinanceParser,
        Broker.NINJA_TRADER: NinjaTrader8Parser,
        Broker.TRADOVATE: TradovateParser,
    }
    
    @classmethod
    def parse_file(
        cls,
        file_path: Union[str, Path],
        broker: Optional[Broker] = None,
        account_id: Optional[str] = None
    ) -> ParserResult:
        """
        פענח קובץ CSV עם זיהוי אוטומטי או ברוקר מוגדר
        
        Args:
            file_path: נתיב לקובץ
            broker: ברוקר ספציפי (אופציונלי - יזהה אוטומטית)
            account_id: מזהה החשבון
            
        Returns:
            ParserResult עם העסקאות והשגיאות
        """
        path = Path(file_path)
        
        if broker is None:
            broker = cls.detect_broker(path)
        
        parser_class = cls.PARSERS.get(broker, GenericCSVParser)
        parser = parser_class(account_id=account_id)
        
        return parser.parse_file(path)
    
    @classmethod
    def parse_string(
        cls,
        csv_content: str,
        broker: Optional[Broker] = None,
        account_id: Optional[str] = None
    ) -> ParserResult:
        """
        פענח תוכן CSV מחרוזת
        """
        if broker is None:
            broker = cls.detect_broker_from_content(csv_content)
        
        parser_class = cls.PARSERS.get(broker, GenericCSVParser)
        parser = parser_class(account_id=account_id)
        
        return parser.parse_string(csv_content)
    
    @classmethod
    def detect_broker(cls, file_path: Path) -> Broker:
        """
        זהה את הברוקר מקובץ CSV
        
        משתמש בשם הקובץ וב-headers כדי לזהות את הפורמט
        """
        # בדוק לפי שם הקובץ
        filename = file_path.stem.lower()
        
        if "interactive" in filename or "ib_" in filename or "ibkr" in filename:
            return Broker.INTERACTIVE_BROKERS
        
        if "metatrader" in filename or "mt4" in filename or "mt5" in filename:
            return Broker.METATRADER4
        
        if "binance" in filename:
            return Broker.BINANCE
        
        if "ninja" in filename or "ninjatrader" in filename or "nt8" in filename:
            return Broker.NINJA_TRADER
        
        if "tradovate" in filename:
            return Broker.TRADOVATE
        
        # קרא את ה-headers ונסה לזהות
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_lines = ''.join([f.readline() for _ in range(5)])
            return cls.detect_broker_from_content(first_lines)
        except:
            return Broker.GENERIC
    
    @classmethod
    def detect_broker_from_content(cls, content: str) -> Broker:
        """
        זהה את הברוקר מתוכן CSV
        """
        content_lower = content.lower()
        
        # Interactive Brokers signatures
        ib_signatures = [
            "ibcommission",
            "ibtradeid",
            "account management",
            "flex query",
            "statement,header",
            "u1234567",  # IB account format
        ]
        if any(sig in content_lower for sig in ib_signatures):
            return Broker.INTERACTIVE_BROKERS
        
        # NinjaTrader signatures
        nt_signatures = [
            "market pos.",
            "market position",
            "entry name",
            "exit name",
            "mae",  # Maximum Adverse Excursion
            "mfe",  # Maximum Favorable Excursion
            "etd",  # End Trade Drawdown
            "cum. profit",
            "trade #",
            "ninjatrader",
        ]
        nt_count = sum(1 for sig in nt_signatures if sig in content_lower)
        if nt_count >= 2:
            return Broker.NINJA_TRADER
        
        # Tradovate signatures
        tradovate_signatures = [
            "tradovate",
            "contractid",
            "ordstatus",
            "ordtype",
            "avgfillprice",
            "filledqty",
            "b/s",
            "cumulative p&l",
            "contract", # Common in breakdown
            "commission",
        ]
        tradovate_count = sum(1 for sig in tradovate_signatures if sig in content_lower)
        
        # Specific check for Breakdown format: "Date,Contract,B/S,Qty,Price"
        if "contract" in content_lower and "b/s" in content_lower and "qty" in content_lower:
            return Broker.TRADOVATE
            
        # Specific check for Performance format: "symbol,buyPrice,sellPrice"
        if "buyprice" in content_lower and "sellprice" in content_lower and "boughttimestamp" in content_lower:
            return Broker.TRADOVATE
            
        if tradovate_count >= 2:
            return Broker.TRADOVATE
        
        # MetaTrader signatures
        mt_signatures = [
            "ticket",
            "open time",
            "close time",
            "swap",
            "t/p",  # Take Profit
            "s/l",  # Stop Loss
        ]
        mt_count = sum(1 for sig in mt_signatures if sig in content_lower)
        if mt_count >= 3:
            return Broker.METATRADER4
        
        # Binance signatures
        binance_signatures = [
            "date(utc)",
            "pair",
            "binance",
            "quote quantity",
            "commission asset",
            "busd",
            "usdt",
            "bnb",
        ]
        binance_count = sum(1 for sig in binance_signatures if sig in content_lower)
        if binance_count >= 2:
            return Broker.BINANCE
        
        # ברירת מחדל
        return Broker.GENERIC
    
    @classmethod
    def get_parser(
        cls, 
        broker: Broker, 
        account_id: Optional[str] = None
    ) -> BaseParser:
        """
        קבל Parser לפי ברוקר
        """
        parser_class = cls.PARSERS.get(broker, GenericCSVParser)
        return parser_class(account_id=account_id)
    
    @classmethod
    def get_supported_brokers(cls) -> list:
        """
        קבל רשימת ברוקרים נתמכים
        """
        return [
            {
                "broker": broker.value,
                "name": broker.name.replace("_", " ").title(),
                "description": cls._get_broker_description(broker)
            }
            for broker in cls.PARSERS.keys()
        ]
    
    @classmethod
    def _get_broker_description(cls, broker: Broker) -> str:
        """תיאור קצר לכל ברוקר"""
        descriptions = {
            Broker.GENERIC: "Generic CSV format - works with any properly formatted file",
            Broker.INTERACTIVE_BROKERS: "Interactive Brokers Flex Query or Activity Statement export",
            Broker.METATRADER4: "MetaTrader 4 Account History export",
            Broker.METATRADER5: "MetaTrader 5 Account History export",
            Broker.BINANCE: "Binance Spot or Futures Trade History export",
            Broker.NINJA_TRADER: "NinjaTrader 8 Trade Performance export",
            Broker.TRADOVATE: "Tradovate Trade History or Order History export",
        }
        return descriptions.get(broker, "")
