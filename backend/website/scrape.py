"""
website/scrape.py
Usage:  python scrape.py <URL>
Example: python scrape.py https://example.com
"""

import sys, os
from datetime import datetime


def normalize_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def scrape_website(url: str, headless: bool = True) -> str:
    """Return the visible text of a page. Raises on errors (never sys.exit)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url, timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        text = page.inner_text("body")
        browser.close()
    return text


def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape.py <URL>")
        sys.exit(1)

    url = normalize_url(sys.argv[1])
    print(f"Fetching: {url}")

    try:
        text = scrape_website(url, headless=False)
    except Exception as e:
        print(f"ERROR fetching URL: {e}")
        sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() else "_" for c in url.split("//", 1)[-1])[:80]
    output_dir = os.path.join(script_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{safe_name}__{timestamp}.txt")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Saved ({len(text):,} chars) → {output_path}")

    # store in vector database
    sys.path.append(os.path.join(script_dir, ".."))
    from vector_store import add_document
    count = add_document(text, url, "website")
    print(f"Stored {count} chunks in vector DB")


if __name__ == "__main__":
    main()