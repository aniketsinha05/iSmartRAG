"""
ppt/parse_ppt.py
Usage:  python parse_ppt.py <filename>
Place file in input/ folder. Output goes to output/ with a datetime stamp.
"""

import sys, os
from datetime import datetime


def parse_ppt(input_path: str) -> str:
    """Return all content of a .pptx as text. Raises on errors (never sys.exit)."""
    from pptx import Presentation

    filename = os.path.basename(input_path)
    prs = Presentation(input_path)

    lines = [
        f"FILE: {filename}",
        f"PARSED AT: {datetime.now()}",
    ]

    # ── core properties ────────────────────────────────────────────────────
    lines.append("\n" + "=" * 60)
    lines.append("CORE PROPERTIES")
    lines.append("=" * 60)
    try:
        cp = prs.core_properties
        for attr in ["title", "author", "subject", "keywords", "description",
                     "category", "last_modified_by", "created", "modified", "revision"]:
            lines.append(f"{attr}: {getattr(cp, attr, None)}")
    except Exception as e:
        lines.append(f"[Could not read core properties: {e}]")

    lines.append(f"\ntotal_slides: {len(prs.slides)}")

    # ── slides ─────────────────────────────────────────────────────────────
    for slide_idx, slide in enumerate(prs.slides):
        lines.append("\n" + "=" * 60)
        lines.append(f"SLIDE {slide_idx + 1}")
        lines.append("=" * 60)

        try:
            lines.append(f"layout: {slide.slide_layout.name}")
        except Exception as e:
            lines.append(f"layout: [ERROR: {e}]")

        for shape_idx, shape in enumerate(slide.shapes):
            lines.append(f"\n  -- Shape {shape_idx + 1} --")

            try:
                lines.append(f"  name: {shape.name}")
            except Exception as e:
                lines.append(f"  name: [ERROR: {e}]")

            # text frame
            try:
                if shape.has_text_frame:
                    lines.append("  [TEXT FRAME]")
                    for para_idx, para in enumerate(shape.text_frame.paragraphs):
                        lines.append(f"    para[{para_idx}]: {para.text}")
            except Exception as e:
                lines.append(f"  text_frame: [ERROR: {e}]")

            # table
            try:
                if shape.has_table:
                    lines.append("  [TABLE]")
                    for row_idx, row in enumerate(shape.table.rows):
                        cells = [cell.text for cell in row.cells]
                        lines.append(f"    row[{row_idx}]: {' | '.join(cells)}")
            except Exception as e:
                lines.append(f"  table: [ERROR: {e}]")

            # chart
            try:
                if shape.has_chart:
                    chart = shape.chart
                    lines.append("  [CHART]")
                    lines.append(f"    chart_type: {chart.chart_type}")
                    title_text = chart.chart_title.text_frame.text if chart.has_title else "(no title)"
                    lines.append(f"    chart_title: {title_text}")
                    for series in chart.series:
                        lines.append(f"    series: {series.name}")
            except Exception as e:
                lines.append(f"  chart: [ERROR: {e}]")

        # speaker notes
        try:
            if slide.has_notes_slide:
                lines.append(f"\n  [SPEAKER NOTES]\n  {slide.notes_slide.notes_text_frame.text}")
        except Exception as e:
            lines.append(f"  notes: [ERROR: {e}]")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_ppt.py <filename>")
        print("Example: python parse_ppt.py deck.pptx")
        sys.exit(1)

    filename = sys.argv[1].strip()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "input", filename)

    if not os.path.isfile(input_path):
        print(f"ERROR: File not found: {input_path}")
        print(f"Place '{filename}' inside the input/ folder and try again.")
        sys.exit(1)

    try:
        text = parse_ppt(input_path)
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
    count = add_document(text, filename, "ppt")
    print(f"Stored {count} chunks in vector DB")


if __name__ == "__main__":
    main()