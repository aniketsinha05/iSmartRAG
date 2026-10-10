"""
pdf/parse_pdf.py
Usage:  python parse_pdf.py <filename>
Place file in input/ folder. Output goes to output/ with a datetime stamp.
"""

import sys, os
from datetime import datetime


def parse_pdf(input_path: str) -> str:
    """Return all text from a PDF. Raises on errors (never sys.exit) so the API can handle them."""
    from pypdf import PdfReader

    filename = os.path.basename(input_path)
    reader = PdfReader(input_path)

    lines = [
        f"FILE: {filename}",
        f"PARSED AT: {datetime.now()}",
        f"TOTAL PAGES: {len(reader.pages)}",
    ]

    for idx, page in enumerate(reader.pages):
        lines.append("\n" + "=" * 60)
        lines.append(f"PAGE {idx + 1}")
        lines.append("=" * 60)
        try:
            lines.append(page.extract_text() or "")
        except Exception as e:
            lines.append(f"[ERROR: {e}]")

    return "\n".join(lines)


def parse_pdf_pieces(input_path: str) -> list:
    """Return one piece per page: {"text", "page"}."""
    from pypdf import PdfReader

    pieces = []
    for idx, page in enumerate(PdfReader(input_path).pages):
        try:
            text = (page.extract_text() or "").strip()
        except Exception:
            text = ""
        if text:
            pieces.append({"text": text, "page": idx + 1})
    return pieces


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_pdf.py <filename>")
        sys.exit(1)

    filename = sys.argv[1].strip()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "input", filename)

    if not os.path.isfile(input_path):
        print(f"ERROR: File not found: {input_path}")
        sys.exit(1)

    try:
        text = parse_pdf(input_path)
    except Exception as e:
        print(f"ERROR parsing file: {e}")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = os.path.splitext(filename)[0]
    output_dir = os.path.join(script_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{base}__{timestamp}.txt")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Done! Output → {output_path}")

    # store in vector database
    sys.path.append(os.path.join(script_dir, ".."))
    from vector_store import add_document
    count = add_document(text, filename, "pdf")
    print(f"Stored {count} chunks in vector DB")


if __name__ == "__main__":
    main()