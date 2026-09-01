"""
website/scrape.py
Usage:  python scrape.py <URL>
Example: python scrape.py https://example.com
"""

import sys, os, re
from datetime import datetime

def sanitize_filename(url: str) -> str:
    name = re.sub(r'^https?://', '', url)
    name = re.sub(r'[^\w]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return name[:80]

def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape.py <URL>")
        sys.exit(1)

    url = sys.argv[1].strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not found. Installing...")
        os.system("pip install playwright --break-system-packages -q")
        os.system("playwright install chromium")
        from playwright.sync_api import sync_playwright

    print(f"Fetching: {url}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()
            page.goto(url, timeout=60000)
            page.wait_for_load_state("networkidle", timeout=60000)
            html = page.content()
            browser.close()
    except Exception as e:
        print(f"ERROR fetching URL: {e}")
        sys.exit(1)

    timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name  = sanitize_filename(url)
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{safe_name}__{timestamp}.html")

    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Saved ({len(html):,} chars) → {output_path}")
    except Exception as e:
        print(f"ERROR writing output: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()