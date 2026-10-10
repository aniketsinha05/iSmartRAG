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


def scrape_website(url: str, headless: bool = False) -> str:
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


_BLOCKS_JS = """
() => {
  const sel = 'h1,h2,h3,h4,p,li,tr,pre,blockquote';
  const skip = 'nav,footer,script,style,noscript';
  const out = [];
  document.body.querySelectorAll(sel).forEach(el => {
    if (el.closest(skip)) return;
    if (el.parentElement && el.parentElement.closest(sel)) return;
    const tag = el.tagName.toLowerCase();
    const text = tag === 'tr'
      ? Array.from(el.children).map(c => c.innerText.trim()).filter(Boolean).join(' | ')
      : el.innerText.trim();
    if (text) out.push([tag, text]);
  });
  return out;
}
"""


def scrape_website_pieces(url: str, headless: bool = False) -> list:
    """Return one piece per heading section: {"text", "section"}. Raises on errors."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url, timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        blocks = page.evaluate(_BLOCKS_JS)
        body = page.inner_text("body")
        browser.close()

    if not blocks:  # page without normal text tags: use the plain text
        return [{"text": body.strip()}] if body.strip() else []

    pieces, buf, section = [], [], None

    def flush():
        text = "\n".join(buf).strip()
        if text:
            pieces.append({"text": text, "section": section})
        buf.clear()

    for tag, text in blocks:
        if tag in ("h1", "h2", "h3", "h4"):
            flush()
            section = text
        else:
            buf.append(text)
    flush()
    return pieces


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