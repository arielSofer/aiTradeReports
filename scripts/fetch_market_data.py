"""
סקריפט להורדת נתוני שוק היסטוריים של NQ Futures
משתמש ב-yfinance לקבלת נתונים ושומר בפורמט מתאים ל-Lightweight Charts
תומך ב-timeframes שונים: 5m, 15m, 1h
"""

import yfinance as yf
import json
import pandas as pd
from pathlib import Path


# הגדרת Timeframes נתמכים
TIMEFRAMES = {
    "5m": {"interval": "5m", "period": "5d"},    # 5 דקות - עד 60 יום
    "15m": {"interval": "15m", "period": "14d"}, # 15 דקות - עד 60 יום  
    "1h": {"interval": "1h", "period": "1mo"},   # שעה - עד 730 יום
}


def fetch_market_data_for_timeframe(ticker: str, timeframe: str, output_dir: Path) -> list:
    """מוריד נתונים עבור timeframe ספציפי"""
    
    if timeframe not in TIMEFRAMES:
        print(f"Timeframe לא נתמך: {timeframe}")
        return []
    
    tf_config = TIMEFRAMES[timeframe]
    print(f"  מוריד {timeframe}...")
    
    df = yf.download(ticker, period=tf_config["period"], interval=tf_config["interval"])
    
    if df.empty:
        print(f"  לא נמצאו נתונים עבור {timeframe}")
        return []
    
    chart_data = []
    
    for index, row in df.iterrows():
        timestamp = int(index.timestamp())
        
        # טיפול ב-MultiIndex columns
        open_val = row['Open'].iloc[0] if hasattr(row['Open'], 'iloc') else row['Open']
        high_val = row['High'].iloc[0] if hasattr(row['High'], 'iloc') else row['High']
        low_val = row['Low'].iloc[0] if hasattr(row['Low'], 'iloc') else row['Low']
        close_val = row['Close'].iloc[0] if hasattr(row['Close'], 'iloc') else row['Close']
        
        chart_data.append({
            "time": timestamp,
            "open": round(float(open_val), 2),
            "high": round(float(high_val), 2),
            "low": round(float(low_val), 2),
            "close": round(float(close_val), 2),
        })
    
    # שמירה לקובץ עם שם ה-timeframe
    output_file = output_dir / f"marketData_{timeframe}.json"
    with open(output_file, "w") as f:
        json.dump(chart_data, f, indent=2)
    
    print(f"  ✓ נשמרו {len(chart_data)} נרות ל-{output_file.name}")
    
    return chart_data


def fetch_market_data():
    """מוריד נתוני NQ Futures בכל ה-timeframes"""
    
    ticker = "NQ=F"
    print(f"=== מוריד נתונים עבור {ticker} ===\n")
    
    output_dir = Path(__file__).parent.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    all_data = {}
    
    # הורדת כל ה-timeframes
    for tf in TIMEFRAMES.keys():
        data = fetch_market_data_for_timeframe(ticker, tf, output_dir)
        if data:
            all_data[tf] = data
    
    # שמירת קובץ ברירת מחדל (1h) גם כ-marketData.json לתאימות אחורה
    if "1h" in all_data:
        default_file = output_dir / "marketData.json"
        with open(default_file, "w") as f:
            json.dump(all_data["1h"], f, indent=2)
        print(f"\n✓ קובץ ברירת מחדל: {default_file.name}")
    
    # הדפסת סיכום
    print("\n=== סיכום ===")
    for tf, data in all_data.items():
        if data:
            print(f"{tf}: {len(data)} נרות | ראשון: {data[0]['time']} | אחרון: {data[-1]['time']}")
    
    # יצירת עסקאות לדוגמה
    if "1h" in all_data:
        create_sample_trades(all_data["1h"], output_dir)
    
    return all_data


def create_sample_trades(chart_data, output_dir):
    """יוצר קובץ עסקאות לדוגמה עם זמנים תואמים לנתוני השוק"""
    
    if len(chart_data) < 30:
        print("אין מספיק נתונים ליצירת עסקאות לדוגמה")
        return
    
    # בוחר נרות מהמידע האמיתי
    sample_trades = [
        {
            "id": 1,
            "time": chart_data[5]['time'],
            "type": "BUY",
            "price": chart_data[5]['close'],
            "notes": "פריצה של VWAP"
        },
        {
            "id": 2,
            "time": chart_data[10]['time'],
            "type": "SELL",
            "price": chart_data[10]['close'],
            "notes": "יציאה ברווח (TP)"
        },
        {
            "id": 3,
            "time": chart_data[20]['time'],
            "type": "SELL_SHORT",
            "price": chart_data[20]['close'],
            "notes": "כניסה לשורט בהתנגדות"
        },
        {
            "id": 4,
            "time": chart_data[25]['time'],
            "type": "BUY",
            "price": chart_data[25]['close'],
            "notes": "סגירת שורט ברווח"
        }
    ]
    
    trades_file = output_dir / "sampleTrades.json"
    
    with open(trades_file, "w", encoding='utf-8') as f:
        json.dump(sample_trades, f, indent=2, ensure_ascii=False)
    
    print(f"\nנוצר קובץ עסקאות לדוגמה: {trades_file}")


if __name__ == "__main__":
    fetch_market_data()

