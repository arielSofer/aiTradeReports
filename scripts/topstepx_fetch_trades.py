#!/usr/bin/env python3
"""
TopstepX Trade Fetcher
======================

סקריפט Python לשליפת היסטוריית טריידים מ-TopstepX API ישירות.
שולח בקשה ל-API הפנימי של TopstepX ושומר את הנתונים ל-CSV.

Usage:
    python topstepx_fetch_trades.py --share-id 7534754
    python topstepx_fetch_trades.py --share-id 7534754 --output my_trades.csv
"""

import argparse
import csv
import json
import requests
from datetime import datetime
from typing import List, Dict, Any


def fetch_trades(trading_account_id: int, from_date: str = "2020-01-01T00:00:00Z", 
                 to_date: str = "2030-12-31T23:59:59Z") -> List[Dict[str, Any]]:
    """
    שולף טריידים מ-TopstepX API
    
    Args:
        trading_account_id: מזהה החשבון/שיתוף של TopstepX
        from_date: תאריך התחלה בפורמט ISO
        to_date: תאריך סיום בפורמט ISO
        
    Returns:
        רשימת טריידים
    """
    url = "https://userapi.topstepx.com/Statistics/trades"
    
    payload = {
        "tradingAccountId": trading_account_id,
        "fromDate": from_date,
        "toDate": to_date
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://topstepx.com",
        "Referer": "https://topstepx.com/"
    }
    
    print(f"📡 שולח בקשה ל-TopstepX API...")
    print(f"   Account ID: {trading_account_id}")
    print(f"   From: {from_date}")
    print(f"   To: {to_date}")
    
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    
    if response.status_code != 200:
        raise Exception(f"שגיאה בבקשת API: {response.status_code} - {response.text}")
    
    trades = response.json()
    print(f"✅ התקבלו {len(trades)} טריידים")
    
    return trades


def save_to_csv(trades: List[Dict[str, Any]], output_file: str) -> None:
    """
    שומר טריידים לקובץ CSV
    
    Args:
        trades: רשימת טריידים
        output_file: שם קובץ הפלט
    """
    if not trades:
        print("⚠️ אין טריידים לשמירה")
        return
    
    # קבל את כל השדות האפשריים
    all_fields = set()
    for trade in trades:
        all_fields.update(trade.keys())
    
    # סדר את השדות בסדר הגיוני (based on actual API response)
    priority_fields = [
        'id', 'symbolId', 'positionSize', 'profitAndLoss', 'fees',
        'entryPrice', 'exitPrice', 'tradeDay', 'createdAt', 'enteredAt'
    ]
    
    fieldnames = []
    for field in priority_fields:
        if field in all_fields:
            fieldnames.append(field)
            all_fields.discard(field)
    
    # הוסף שאר השדות בסדר אלפביתי
    fieldnames.extend(sorted(all_fields))
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(trades)
    
    print(f"💾 נשמר ל: {output_file}")


def save_to_json(trades: List[Dict[str, Any]], output_file: str) -> None:
    """
    שומר טריידים לקובץ JSON
    
    Args:
        trades: רשימת טריידים
        output_file: שם קובץ הפלט
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(trades, f, indent=2, ensure_ascii=False)
    
    print(f"💾 נשמר ל: {output_file}")


def print_summary(trades: List[Dict[str, Any]]) -> None:
    """
    מדפיס סיכום סטטיסטי של הטריידים
    
    Args:
        trades: רשימת טריידים
    """
    if not trades:
        return
    
    # API returns 'profitAndLoss' field, not 'pnL'
    total_pnl = sum(t.get('profitAndLoss', 0) for t in trades)
    total_fees = sum(t.get('fees', 0) for t in trades)
    
    winning_trades = [t for t in trades if t.get('profitAndLoss', 0) > 0]
    losing_trades = [t for t in trades if t.get('profitAndLoss', 0) < 0]
    
    # API returns 'symbolId' field, not 'symbolName'
    symbols = set(t.get('symbolId', '') for t in trades)
    
    net_pnl = total_pnl - abs(total_fees)
    
    print("\n" + "="*50)
    print("📊 סיכום סטטיסטי")
    print("="*50)
    print(f"סה\"כ טריידים:     {len(trades)}")
    print(f"טריידים מנצחים:   {len(winning_trades)} ({100*len(winning_trades)/len(trades):.1f}%)")
    print(f"טריידים מפסידים:  {len(losing_trades)} ({100*len(losing_trades)/len(trades):.1f}%)")
    print(f"סה\"כ רווח/הפסד:   ${total_pnl:,.2f}")
    print(f"סה\"כ fees:        ${abs(total_fees):,.2f}")
    print(f"רווח נקי:         ${net_pnl:,.2f}")
    print(f"סמלים נסחרו:      {', '.join(sorted(filter(None, symbols)))}")
    print("="*50)


def main():
    parser = argparse.ArgumentParser(
        description="שליפת טריידים מ-TopstepX API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
דוגמאות שימוש:
  python topstepx_fetch_trades.py --share-id 7534754
  python topstepx_fetch_trades.py --share-id 7534754 --output my_trades.csv
  python topstepx_fetch_trades.py --share-id 7534754 --format json
        """
    )
    
    parser.add_argument(
        '--share-id', '-s',
        type=int,
        required=True,
        help='מזהה שיתוף של TopstepX (למשל: 7534754)'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help='שם קובץ הפלט (ברירת מחדל: topstepx_trades_<id>.csv)'
    )
    
    parser.add_argument(
        '--format', '-f',
        choices=['csv', 'json', 'both'],
        default='csv',
        help='פורמט הפלט (csv/json/both)'
    )
    
    parser.add_argument(
        '--from-date',
        type=str,
        default="2020-01-01T00:00:00Z",
        help='תאריך התחלה (ברירת מחדל: 2020-01-01)'
    )
    
    parser.add_argument(
        '--to-date',
        type=str,
        default="2030-12-31T23:59:59Z",
        help='תאריך סיום (ברירת מחדל: 2030-12-31)'
    )
    
    parser.add_argument(
        '--no-summary',
        action='store_true',
        help='דלג על הסיכום הסטטיסטי'
    )
    
    args = parser.parse_args()
    
    try:
        # שלוף טריידים
        trades = fetch_trades(
            args.share_id, 
            args.from_date, 
            args.to_date
        )
        
        # קבע שם קובץ פלט
        base_name = args.output or f"topstepx_trades_{args.share_id}"
        if args.output and '.' in args.output:
            base_name = args.output.rsplit('.', 1)[0]
        
        # שמור לקבצים
        if args.format in ['csv', 'both']:
            csv_file = f"{base_name}.csv"
            save_to_csv(trades, csv_file)
        
        if args.format in ['json', 'both']:
            json_file = f"{base_name}.json"
            save_to_json(trades, json_file)
        
        # הדפס סיכום
        if not args.no_summary:
            print_summary(trades)
        
        print("\n✨ הסתיים בהצלחה!")
        
    except requests.exceptions.Timeout:
        print("❌ שגיאה: הבקשה עברה זמן מקסימלי (timeout)")
        exit(1)
    except requests.exceptions.RequestException as e:
        print(f"❌ שגיאת רשת: {e}")
        exit(1)
    except Exception as e:
        print(f"❌ שגיאה: {e}")
        exit(1)


if __name__ == "__main__":
    main()

