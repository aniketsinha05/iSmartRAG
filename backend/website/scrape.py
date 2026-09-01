"""
website/scrape.py
Usage:  python scrape.py <URL>
Fetches the complete raw HTML of the URL and saves it to output/ with a datetime stamp.
Nothing is parsed, filtered, or modified — bytes go straight to disk.
"""

import sys, os, re
from datetime import datetime
import urllib.request
import urllib.error

def sanitize_filename(url: str) -> str:
    name = re.sub(r'^https?://', '', url)
    name = re.sub(r'[^\w]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    return name[:80]

def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape.py <URL>")
        print("Example: python scrape.py https://example.com")
        sys.exit(1)

    url = sys.argv[1].strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    print(f"Fetching: {url}")

    # ── fetch raw bytes ────────────────────────────────────────────────────
    raw_bytes = None
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw_bytes = resp.read()
            charset   = resp.headers.get_content_charset()   # may be None
            status    = resp.status
            final_url = resp.url
        print(f"HTTP {status}  final_url: {final_url}  bytes: {len(raw_bytes):,}")
    except urllib.error.HTTPError as e:
        print(f"HTTP error {e.code}: {e.reason} — saving whatever body was returned")
        try:
            raw_bytes = e.read()
            charset   = None
        except Exception as e2:
            print(f"Could not read error body: {e2}")
    except Exception as e:
        print(f"ERROR fetching URL: {e}")
        sys.exit(1)

    if raw_bytes is None:
        print("Nothing to save.")
        sys.exit(1)

    # ── decode bytes → str (best-effort, no data loss) ────────────────────
    html = None
    for enc in filter(None, [charset, "utf-8", "latin-1"]):
        try:
            html = raw_bytes.decode(enc, errors="replace")
            break
        except Exception:
            continue
    if html is None:
        # absolute fallback: latin-1 never fails
        html = raw_bytes.decode("latin-1", errors="replace")

    # ── write output ───────────────────────────────────────────────────────
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
