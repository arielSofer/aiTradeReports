"""
Base Parser - מחלקת בסיס לכל ה-Parsers
======================================

כל Parser חדש יורש ממחלקה זו ומממש את המתודות הנדרשות.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
import pandas as pd
import io

from ..models.trade import Trade, TradeCollection
from ..models.account import Broker


@dataclass
class ParserError:
    """שגיאה שזוהתה בזמן הפענוח"""
    row_number: int
    column: Optional[str]
    message: str
    raw_value: Optional[str] = None
    
    def __str__(self) -> str:
        col_info = f" (column: {self.column})" if self.column else ""
        return f"Row {self.row_number}{col_info}: {self.message}"


@dataclass
class ParserResult:
    """
    תוצאת הפענוח
    
    מכיל את העסקאות שנקלטו בהצלחה וגם את השגיאות
    """
    trades: TradeCollection
    errors: List[ParserError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # סטטיסטיקות
    total_rows: int = 0
    parsed_successfully: int = 0
    skipped_rows: int = 0
    
    @property
    def success_rate(self) -> float:
        """אחוז הצלחה בפענוח"""
        if self.total_rows == 0:
            return 0.0
        return (self.parsed_successfully / self.total_rows) * 100
    
    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    def add_error(
        self, 
        row_number: int, 
        message: str, 
        column: Optional[str] = None,
        raw_value: Optional[str] = None
    ) -> None:
        """הוסף שגיאה"""
        self.errors.append(ParserError(
            row_number=row_number,
            column=column,
            message=message,
            raw_value=raw_value
        ))
    
    def add_warning(self, message: str) -> None:
        """הוסף אזהרה (לא מונעת פענוח)"""
        self.warnings.append(message)
    
    def get_summary(self) -> Dict[str, Any]:
        """קבל סיכום הפענוח"""
        return {
            "total_rows": self.total_rows,
            "parsed_successfully": self.parsed_successfully,
            "skipped_rows": self.skipped_rows,
            "success_rate": f"{self.success_rate:.1f}%",
            "errors_count": len(self.errors),
            "warnings_count": len(self.warnings),
            "total_trades": self.trades.total_trades,
            "total_pnl": float(self.trades.total_pnl) if self.trades.trades else 0,
            "win_rate": self.trades.win_rate
        }


class BaseParser(ABC):
    """
    מחלקת בסיס אבסטרקטית לכל ה-Parsers
    
    כל ברוקר מממש את המתודות האבסטרקטיות לפי הפורמט שלו.
    """
    
    # כל Parser מגדיר את הברוקר שלו
    BROKER: Broker = Broker.GENERIC
    
    # עמודות חובה (כל Parser מגדיר את שלו)
    REQUIRED_COLUMNS: List[str] = []
    
    # מיפוי עמודות: שם עמודה בקובץ -> שם שדה במודל
    COLUMN_MAPPING: Dict[str, str] = {}
    
    # פורמט תאריך/שעה (strptime format)
    DATETIME_FORMAT: str = "%Y-%m-%d %H:%M:%S"
    
    # אנקודינג ברירת מחדל
    DEFAULT_ENCODING: str = "utf-8"
    
    def __init__(self, account_id: Optional[str] = None):
        """
        אתחול ה-Parser
        
        Args:
            account_id: מזהה החשבון אליו לשייך את העסקאות
        """
        self.account_id = account_id
    
    def parse_file(self, file_path: Union[str, Path]) -> ParserResult:
        """
        פענח קובץ CSV
        
        Args:
            file_path: נתיב לקובץ
            
        Returns:
            ParserResult עם העסקאות והשגיאות
        """
        path = Path(file_path)
        
        if not path.exists():
            result = ParserResult(trades=TradeCollection())
            result.add_error(0, f"File not found: {path}")
            return result
        
        # קרא את הקובץ
        try:
            df = self._read_csv(path)
        except Exception as e:
            result = ParserResult(trades=TradeCollection())
            result.add_error(0, f"Failed to read CSV: {str(e)}")
            return result
        
        return self._parse_dataframe(df, source_file=str(path))
    
    def parse_string(self, csv_content: str) -> ParserResult:
        """
        פענח תוכן CSV כמחרוזת
        
        שימושי לקבלת נתונים מ-API או העתק-הדבק
        """
        try:
            df = pd.read_csv(io.StringIO(csv_content))
        except Exception as e:
            result = ParserResult(trades=TradeCollection())
            result.add_error(0, f"Failed to parse CSV content: {str(e)}")
            return result
        
        return self._parse_dataframe(df)
    
    def _read_csv(self, path: Path) -> pd.DataFrame:
        """
        קרא קובץ CSV ל-DataFrame
        
        ניתן לדריסה אם ברוקר דורש הגדרות קריאה מיוחדות
        """
        # נסה אנקודינגים שונים
        encodings = [self.DEFAULT_ENCODING, "latin-1", "cp1252", "iso-8859-1"]
        
        last_error = None
        for encoding in encodings:
            try:
                return pd.read_csv(path, encoding=encoding)
            except UnicodeDecodeError as e:
                last_error = e
                continue
            except Exception as e:
                raise e
        
        raise last_error or ValueError("Could not read file with any encoding")
    
    def _parse_dataframe(
        self, 
        df: pd.DataFrame, 
        source_file: Optional[str] = None
    ) -> ParserResult:
        """
        פענח DataFrame לעסקאות
        """
        result = ParserResult(
            trades=TradeCollection(
                source_file=source_file,
                broker_name=self.BROKER.value
            ),
            total_rows=len(df)
        )
        
        # נקה שמות עמודות
        df.columns = df.columns.str.strip()
        
        # בדוק עמודות חובה
        missing = self._check_required_columns(df)
        if missing:
            result.add_error(
                0, 
                f"Missing required columns: {', '.join(missing)}"
            )
            return result
        
        # מפה עמודות
        df = self._apply_column_mapping(df)
        
        # נרמל את הנתונים לפני הפענוח
        df = self._normalize_dataframe(df)
        
        # פענח כל שורה
        for idx, row in df.iterrows():
            row_num = idx + 2  # +2 כי יש header ו-pandas מתחיל מ-0
            
            try:
                # דלג על שורות ריקות
                if self._is_empty_row(row):
                    result.skipped_rows += 1
                    continue
                
                # פענח את השורה לעסקה
                trade = self._parse_row(row, row_num)
                
                if trade:
                    trade.account_id = self.account_id
                    trade.broker_name = self.BROKER.value
                    result.trades.trades.append(trade)
                    result.parsed_successfully += 1
                else:
                    result.skipped_rows += 1
                    
            except ValueError as e:
                result.add_error(row_num, str(e))
            except Exception as e:
                result.add_error(row_num, f"Unexpected error: {str(e)}")
        
        # מיין לפי תאריך
        result.trades.trades.sort(key=lambda t: t.entry_time)
        
        return result
    
    def _check_required_columns(self, df: pd.DataFrame) -> List[str]:
        """בדוק אם כל העמודות הנדרשות קיימות"""
        df_columns = [col.lower() for col in df.columns]
        missing = []
        
        for required in self.REQUIRED_COLUMNS:
            # בדוק גם את השם המקורי וגם את המיפוי
            required_lower = required.lower()
            mapped = self.COLUMN_MAPPING.get(required, required).lower()
            
            if required_lower not in df_columns and mapped not in df_columns:
                missing.append(required)
        
        return missing
    
    def _apply_column_mapping(self, df: pd.DataFrame) -> pd.DataFrame:
        """החל מיפוי עמודות"""
        # צור מיפוי case-insensitive
        rename_map = {}
        for old_name, new_name in self.COLUMN_MAPPING.items():
            for col in df.columns:
                if col.lower() == old_name.lower():
                    rename_map[col] = new_name
                    break
        
        return df.rename(columns=rename_map)
    
    def _is_empty_row(self, row: pd.Series) -> bool:
        """בדוק אם שורה ריקה"""
        return row.isna().all() or (row.astype(str).str.strip() == "").all()
    
    def _normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        נרמל את ה-DataFrame לפני פענוח
        
        ניתן לדריסה אם נדרש עיבוד מקדים ספציפי
        """
        return df
    
    @abstractmethod
    def _parse_row(self, row: pd.Series, row_number: int) -> Optional[Trade]:
        """
        פענח שורה בודדת לעסקה
        
        מתודה אבסטרקטית - כל Parser חייב לממש
        
        Args:
            row: שורה מה-DataFrame
            row_number: מספר השורה (לדיווח שגיאות)
            
        Returns:
            Trade או None אם צריך לדלג
            
        Raises:
            ValueError: אם יש שגיאה בפענוח
        """
        pass
    
    def _parse_datetime(
        self, 
        value: Any, 
        format: Optional[str] = None
    ) -> datetime:
        """
        פענח תאריך ושעה
        
        מנסה פורמטים נפוצים אם הפורמט הספציפי נכשל
        """
        if pd.isna(value):
            raise ValueError("Empty datetime value")
        
        value_str = str(value).strip()
        
        # נסה את הפורמט הספציפי קודם
        formats_to_try = [
            format or self.DATETIME_FORMAT,
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
            "%d.%m.%Y %H:%M:%S",
        ]
        
        for fmt in formats_to_try:
            try:
                return datetime.strptime(value_str, fmt)
            except ValueError:
                continue
        
        # נסה גם pandas
        try:
            return pd.to_datetime(value_str).to_pydatetime()
        except:
            raise ValueError(f"Could not parse datetime: {value_str}")
    
    def _parse_decimal(self, value: Any, allow_negative: bool = True) -> float:
        """פענח מספר עשרוני"""
        if pd.isna(value):
            raise ValueError("Empty numeric value")
        
        # הסר פסיקים ותווים מיוחדים
        value_str = str(value).strip().replace(",", "").replace("$", "")
        
        try:
            result = float(value_str)
            if not allow_negative and result < 0:
                raise ValueError(f"Negative value not allowed: {result}")
            return result
        except ValueError:
            raise ValueError(f"Invalid number: {value}")
    
    def _parse_direction(self, value: Any) -> str:
        """פענח כיוון עסקה (long/short)"""
        if pd.isna(value):
            raise ValueError("Empty direction value")
        
        value_str = str(value).strip().lower()
        
        long_keywords = ["buy", "long", "b", "1", "call"]
        short_keywords = ["sell", "short", "s", "-1", "put", "ss"]
        
        if any(kw in value_str for kw in long_keywords):
            return "long"
        elif any(kw in value_str for kw in short_keywords):
            return "short"
        else:
            raise ValueError(f"Unknown direction: {value}")





