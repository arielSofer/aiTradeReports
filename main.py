#!/usr/bin/env python3
"""
TradeTracker - Trade Analysis Platform
======================================

סקריפט ראשי להמרת קבצי CSV לפורמט JSON אחיד.

שימוש:
    python main.py examples/sample_generic.csv
    python main.py examples/sample_metatrader.csv --output trades.json
    python main.py examples/sample_binance.csv --broker binance

Author: TradeTracker Team
"""

import argparse
import json
import sys
from pathlib import Path
from decimal import Decimal

# הוסף את תיקיית src ל-path
sys.path.insert(0, str(Path(__file__).parent))

from src.parsers import ParserFactory
from src.models.account import Broker


class DecimalEncoder(json.JSONEncoder):
    """JSON Encoder שמטפל ב-Decimal"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def main():
    parser = argparse.ArgumentParser(
        description="🚀 TradeTracker - המר קבצי עסקאות CSV לפורמט JSON אחיד",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
דוגמאות שימוש:
  python main.py examples/sample_generic.csv
  python main.py trades.csv --output analyzed_trades.json
  python main.py binance_export.csv --broker binance --stats

ברוקרים נתמכים:
  generic            - פורמט CSV גנרי
  interactive_brokers - Interactive Brokers
  metatrader4        - MetaTrader 4
  metatrader5        - MetaTrader 5
  binance            - Binance Spot/Futures
        """
    )
    
    parser.add_argument(
        "input_file",
        help="נתיב לקובץ CSV של העסקאות"
    )
    
    parser.add_argument(
        "-o", "--output",
        help="נתיב לקובץ הפלט (JSON). ברירת מחדל: output.json"
    )
    
    parser.add_argument(
        "-b", "--broker",
        choices=["generic", "interactive_brokers", "metatrader4", "metatrader5", "binance"],
        help="סוג הברוקר (אופציונלי - יזהה אוטומטית)"
    )
    
    parser.add_argument(
        "-s", "--stats",
        action="store_true",
        help="הצג סטטיסטיקות מפורטות"
    )
    
    parser.add_argument(
        "-c", "--chart",
        action="store_true",
        help="הוסף פורמט מוכן לגרף"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="הצג מידע מפורט בזמן העיבוד"
    )
    
    args = parser.parse_args()
    
    # בדוק שהקובץ קיים
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"❌ שגיאה: הקובץ לא נמצא: {input_path}")
        sys.exit(1)
    
    # קבע ברוקר אם צוין
    broker = None
    if args.broker:
        broker = Broker(args.broker)
    
    print(f"📁 מעבד קובץ: {input_path}")
    
    # פענח את הקובץ
    result = ParserFactory.parse_file(input_path, broker=broker)
    
    # הצג תוצאות
    print(f"\n{'='*50}")
    print(f"📊 סיכום הפענוח:")
    print(f"{'='*50}")
    
    summary = result.get_summary()
    
    print(f"  🔍 זוהה כ: {result.trades.broker_name}")
    print(f"  📝 שורות בקובץ: {summary['total_rows']}")
    print(f"  ✅ נקלטו בהצלחה: {summary['parsed_successfully']}")
    print(f"  ⏭️  דולגו: {summary['skipped_rows']}")
    print(f"  📈 אחוז הצלחה: {summary['success_rate']}")
    
    if result.has_errors:
        print(f"\n⚠️  שגיאות ({len(result.errors)}):")
        for error in result.errors[:5]:  # הצג רק 5 ראשונות
            print(f"     - {error}")
        if len(result.errors) > 5:
            print(f"     ... ועוד {len(result.errors) - 5} שגיאות")
    
    if result.warnings:
        print(f"\n💡 אזהרות:")
        for warning in result.warnings:
            print(f"     - {warning}")
    
    # הצג סטטיסטיקות אם ביקשו
    if args.stats and result.trades.trades:
        print(f"\n{'='*50}")
        print(f"📈 סטטיסטיקות מסחר:")
        print(f"{'='*50}")
        
        print(f"  💰 סה\"כ P&L: ${float(result.trades.total_pnl):,.2f}")
        print(f"  📊 סה\"כ עסקאות: {result.trades.total_trades}")
        print(f"  ✅ עסקאות מנצחות: {result.trades.winning_trades}")
        print(f"  ❌ עסקאות מפסידות: {result.trades.losing_trades}")
        
        if result.trades.win_rate:
            print(f"  🎯 אחוז הצלחה: {result.trades.win_rate:.1f}%")
        
        if result.trades.profit_factor:
            pf = result.trades.profit_factor
            if pf == float('inf'):
                print(f"  📐 Profit Factor: ∞ (אין הפסדים)")
            else:
                print(f"  📐 Profit Factor: {pf:.2f}")
        
        if result.trades.avg_winner:
            print(f"  📈 ממוצע מנצחת: ${float(result.trades.avg_winner):,.2f}")
        
        if result.trades.avg_loser:
            print(f"  📉 ממוצע מפסידה: ${float(result.trades.avg_loser):,.2f}")
        
        print(f"  💸 סה\"כ עמלות: ${float(result.trades.total_commission):,.2f}")
        
        # P&L יומי
        daily_pnl = result.trades.get_daily_pnl()
        if daily_pnl:
            print(f"\n  📅 P&L יומי:")
            for date, pnl in list(daily_pnl.items())[:7]:  # הצג 7 ימים אחרונים
                emoji = "🟢" if pnl > 0 else "🔴" if pnl < 0 else "⚪"
                print(f"     {date}: {emoji} ${float(pnl):,.2f}")
    
    # שמור לקובץ JSON
    output_path = Path(args.output) if args.output else Path("output.json")
    
    # הכן את הנתונים לייצוא
    export_data = {
        "summary": summary,
        "broker": result.trades.broker_name,
        "source_file": str(input_path),
        "trades": []
    }
    
    for trade in result.trades.trades:
        trade_dict = trade.model_dump(mode="json")
        
        # הוסף פורמט גרף אם ביקשו
        if args.chart:
            trade_dict["chart_format"] = trade.to_chart_format()
        
        export_data["trades"].append(trade_dict)
    
    # אם יש סטטיסטיקות, הוסף אותן
    if args.stats:
        export_data["statistics"] = {
            "total_pnl": float(result.trades.total_pnl),
            "win_rate": result.trades.win_rate,
            "profit_factor": result.trades.profit_factor,
            "total_trades": result.trades.total_trades,
            "winning_trades": result.trades.winning_trades,
            "losing_trades": result.trades.losing_trades,
            "avg_winner": float(result.trades.avg_winner) if result.trades.avg_winner else None,
            "avg_loser": float(result.trades.avg_loser) if result.trades.avg_loser else None,
            "total_commission": float(result.trades.total_commission),
            "daily_pnl": {k: float(v) for k, v in result.trades.get_daily_pnl().items()},
            "hourly_performance": result.trades.get_hourly_performance()
        }
    
    # שמור את הקובץ
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False, cls=DecimalEncoder)
    
    print(f"\n{'='*50}")
    print(f"✅ נשמר בהצלחה: {output_path}")
    print(f"{'='*50}")
    
    # הצג דוגמה של עסקה ראשונה
    if args.verbose and result.trades.trades:
        print(f"\n📋 דוגמה לעסקה ראשונה:")
        first_trade = result.trades.trades[0]
        print(f"   Symbol: {first_trade.symbol}")
        print(f"   Direction: {first_trade.direction.value}")
        print(f"   Entry: {first_trade.entry_time} @ ${float(first_trade.entry_price):.2f}")
        if first_trade.exit_time:
            print(f"   Exit: {first_trade.exit_time} @ ${float(first_trade.exit_price):.2f}")
        if first_trade.pnl_net:
            emoji = "🟢" if first_trade.pnl_net > 0 else "🔴"
            print(f"   P&L: {emoji} ${float(first_trade.pnl_net):,.2f} ({first_trade.pnl_percent:.1f}%)")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

