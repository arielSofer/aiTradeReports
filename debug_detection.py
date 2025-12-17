import sys
import os
from pathlib import Path

# Add src to path
sys.path.append(os.getcwd())

from src.parsers.factory import ParserFactory
from src.models.account import Broker

def test_detection():
    file_path = "Performance.csv"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return

    print(f"Detecting broker for {file_path}...")
    
    broker = ParserFactory.detect_broker(Path(file_path))
    print(f"Detected Broker: {broker}")
    
    if broker != Broker.TRADOVATE:
        print("FAIL: Did not detect TRADOVATE")
    else:
        print("SUCCESS: Detected TRADOVATE")

if __name__ == "__main__":
    test_detection()
