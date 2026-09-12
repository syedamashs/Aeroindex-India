"""
Main Scraper - Runs both Air India and IndiGo scrapers
"""

import subprocess
import sys
from pathlib import Path
from datetime import datetime

######################################
# CONFIGURATION
######################################

SCRAPING_DIR = Path(__file__).resolve().parent

SCRAPERS = [
    ("Air India", SCRAPING_DIR / "airindia.py"),
    ("SpiceJet", SCRAPING_DIR / "spicejet.py"),
]


######################################
# RUN SCRAPER
######################################

def run_scraper(name, script_path):
    """Run a scraper script"""
    
    print(
        f"\n{'='*60}\n"
        f"[{datetime.now()}] Running {name} scraper...\n"
        f"{'='*60}\n"
    )
    
    try:
        result = subprocess.run(
            ["python", str(script_path)],
            timeout=600  # 10 minutes
        )
        
        if result.returncode == 0:
            print(f"\n[SUCCESS] {name} completed!")
            return True
        else:
            print(f"\n[ERROR] {name} failed with code {result.returncode}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"\n[ERROR] {name} timed out!")
        return False
    except Exception as e:
        print(f"\n[ERROR] {name} error: {e}")
        return False


######################################
# MAIN
######################################

if __name__ == "__main__":
    
    print(
        "\n"
        "########################################\n"
        "# AEROINDEX SCRAPING PIPELINE\n"
        "########################################\n"
    )
    
    all_success = True
    
    for name, script in SCRAPERS:
        success = run_scraper(name, script)
        if not success:
            all_success = False
    
    print(
        "\n"
        "########################################\n"
        "# SCRAPING COMPLETE\n"
        "########################################\n"
    )
    
    if all_success:
        print("[SUCCESS] All scrapers completed successfully!")
        sys.exit(0)
    else:
        print("[WARNING] Some scrapers had errors")
        sys.exit(1)
