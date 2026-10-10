"""
word/parse_word.py
Usage:  python parse_word.py <filename>
Place file in input/ folder. Output goes to output/ with a datetime stamp.
"""

import sys, os
from datetime import datetime


def parse_word(input_path: str) -> str:
    """Return all content of a .docx as text. Raises on errors (never sys.exit)."""
    from docx import Document

    filename = os.path.basename(input_path)
    doc = Document(input_path)

    lines = [
        f"FILE: {filename}",
        f"PARSED AT: {datetime.now()}",
    ]

    # ── core properties ────────────────────────────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("CORE PROPERTIES")
    lines.append("=" * 60)
    try:
        cp = doc.core_properties
        for attr in ["title", "author", "subject", "keywords", "description",
                     "category", "last_modified_by", "created", "modified", "revision"]:
            lines.append(f"{attr}: {getattr(cp, attr, None)}")
    except Exception as e:
        lines.append(f"[Could not read core properties: {e}]")

    # ── paragraphs ─────────────────────────────────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("PARAGRAPHS")
    lines.append("=" * 60)
    for para_idx, para in enumerate(doc.paragraphs):
        try:
            style = para.style.name if para.style else "Unknown"
        except Exception:
            style = "Unknown"
        lines.append(f"[{para_idx}] style={style} | {para.text}")

    # ── tables ─────────────────────────────────────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("TABLES")
    lines.append("=" * 60)
    for tbl_idx, table in enumerate(doc.tables):
        lines.append(f"\n-- Table {tbl_idx + 1} --")
        for row_idx, row in enumerate(table.rows):
            cells = [cell.text for cell in row.cells]
            lines.append(f"  row[{row_idx}]: {' | '.join(cells)}")

    # ── inline shapes / images (metadata only) ─────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("INLINE SHAPES")
    lines.append("=" * 60)
    try:
        for shape_idx, shape in enumerate(doc.inline_shapes):
            lines.append(f"[{shape_idx}] type={shape.type}  width={shape.width}  height={shape.height}")
    except Exception as e:
        lines.append(f"[Could not iterate inline shapes: {e}]")

    return "\n".join(lines)


def parse_word_pieces(input_path: str) -> list:
    """Return one piece per heading section: {"text", "section"}."""
    from docx import Document

    doc = Document(input_path)
    if hasattr(doc, "iter_inner_content"):
        blocks = doc.iter_inner_content()  # paragraphs and tables in document order
    else:
        blocks = list(doc.paragraphs) + list(doc.tables)

    pieces, buf, section = [], [], None

    def flush():
        text = "\n".join(buf).strip()
        if text:
            pieces.append({"text": text, "section": section})
        buf.clear()

    for block in blocks:
        if hasattr(block, "rows"):  # table
            for row in block.rows:
                cells = [c.text.strip() for c in row.cells]
                if any(cells):
                    buf.append(" | ".join(cells))
            continue

        text = block.text.strip()
        if not text:
            continue

        try:
            style = block.style.name or ""
        except Exception:
            style = ""

        if style.startswith("Heading") or style == "Title":
            flush()
            section = text
        else:
            buf.append(text)

    flush()
    return pieces


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_word.py <filename>")
        print("Example: python parse_word.py report.docx")
        sys.exit(1)

    filename = sys.argv[1].strip()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "input", filename)

    if not os.path.isfile(input_path):
        print(f"ERROR: File not found: {input_path}")
        print(f"Place '{filename}' inside the input/ folder and try again.")
        sys.exit(1)

    try:
        text = parse_word(input_path)
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
    count = add_document(text, filename, "word")
    print(f"Stored {count} chunks in vector DB")


if __name__ == "__main__":
    main()