import sys
import os
import pandas as pd
from pprint import pprint

# Add src to path
sys.path.append(os.getcwd())

from src.parsers.tradovate import TradovateParser

def test_performance_parsing():
    file_path = "Performance.csv"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return

    print(f"Parsing {file_path}...")
    
    # Initialize parser
    parser = TradovateParser()
    
    # Read file directly to mimic upload
    df = pd.read_csv(file_path)
    
    # Parse
    result = parser.parse_file(file_path)
    
    print(f"Parsed {len(result.trades.trades)} trades")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {result.skipped_rows}")
    
    if result.errors:
        print("\nFirst 5 Errors:")
        for err in result.errors[:5]:
            print(f"  {err}")

    print("-" * 50)
    
    # Inspect first few trades
    for i, trade in enumerate(result.trades.trades[:5]):
        print(f"Trade {i+1}:")
        print(f"  Symbol: {trade.symbol}")
        print(f"  Direction: {trade.direction}")
        print(f"  Entry: {trade.entry_price} @ {trade.entry_time}")
        print(f"  Exit: {trade.exit_price} @ {trade.exit_time}")
        print(f"  Qty: {trade.quantity}")
        print(f"  PnL Net: {trade.pnl_net}")
        print("-" * 30)

    # Check specifically for negative PnL trades
    print("\nChecking for negative PnL trades:")
    neg_pnl_trades = [t for t in result.trades.trades if t.pnl_net is not None and t.pnl_net < 0]
    if neg_pnl_trades:
        print(f"Found {len(neg_pnl_trades)} losing trades.")
        print(f"Sample Loser: {neg_pnl_trades[0].symbol}, PnL: {neg_pnl_trades[0].pnl_net}")
    else:
        print("WARNING: No negative PnL trades found! Parser might be ignoring parens.")

if __name__ == "__main__":
    test_performance_parsing()
