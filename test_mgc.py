import os
import databento as db
from datetime import datetime

API_KEY = "db-JNaYBy7uSVVkWvJ53dnrVvYb8CPje"
SYMBOL = "MGC.c.0"
DATASET = "GLBX.MDP3"

def test_fetch():
    try:
        client = db.Historical(API_KEY)
        # Test Dec 5, 2024 (avoid future if user date is 2025 but maybe meant 2024? Screenshot says 2025... wait. Current date is Dec 21, 2025? User's time is 2025. Is the user in the future? Or did the user mean 2024?
        # Metadata: "The current local time is: 2025-12-21"
        # Okay, assume 2025 is correct.
        
        # Lets try a very recent date, e.g. Dec 19, 2025? No, today is Dec 21. Market closed.
        # Try Dec 18 (Thursday) or Dec 5 (User's date)
        
        start = "2025-12-05T10:00:00"
        end = "2025-12-05T11:00:00"
        
        print(f"Fetching {SYMBOL} from {DATASET} between {start} and {end}...")
        
        # Try 4: MGC.FUT with stype_in='parent'
        print("--- Try 4: MGC.FUT with stype_in='parent' ---")
        try:
            data = client.timeseries.get_range(
                dataset=DATASET,
                symbols=["MGC.FUT"],
                schema="ohlcv-1m",
                start=start,
                end=end,
                stype_in="parent",
            )
            print(f"Rows: {len(data.to_df())}")
        except Exception as e:
            print(f"Error: {e}")

        # Try 5: MGCZ5 (Dec 2025) with stype_in='raw_symbol'
        print("--- Try 5: MGCZ5 with stype_in='raw_symbol' ---")
        try:
            data = client.timeseries.get_range(
                dataset=DATASET,
                symbols=["MGCZ5"],
                schema="ohlcv-1m",
                start=start,
                end=end,
                stype_in="raw_symbol",
            )
            print(f"Rows: {len(data.to_df())}")
        except Exception as e:
            print(f"Error: {e}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_fetch()
