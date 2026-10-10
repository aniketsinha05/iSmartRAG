"""
excel/parse_excel.py
Usage:  python parse_excel.py <filename>
Place file in input/ folder. Output goes to output/ with a datetime stamp.
Supports: .xlsx  .xlsm  .xltx  .xls  .csv
"""

import sys, os
from datetime import datetime


def parse_excel(input_path: str) -> str:
    """Return all content of a spreadsheet as text. Raises on errors (never sys.exit)."""
    filename = os.path.basename(input_path)
    ext = os.path.splitext(filename)[1].lower()

    lines = [
        f"FILE: {filename}",
        f"PARSED AT: {datetime.now()}",
        f"EXTENSION: {ext}",
    ]

    # ── xlsx / xlsm / xltx ────────────────────────────────────────────────
    if ext in (".xlsx", ".xlsm", ".xltx"):
        import openpyxl

        wb = openpyxl.load_workbook(input_path, read_only=True, data_only=True)

        lines.append("\n" + "=" * 60)
        lines.append("WORKBOOK PROPERTIES")
        lines.append("=" * 60)
        try:
            props = wb.properties
            for attr in ["title", "subject", "creator", "keywords", "description",
                         "lastModifiedBy", "created", "modified", "category"]:
                lines.append(f"{attr}: {getattr(props, attr, None)}")
        except Exception as e:
            lines.append(f"[Could not read properties: {e}]")

        lines.append(f"\nsheets: {wb.sheetnames}")

        for sheet_name in wb.sheetnames:
            lines.append("\n" + "=" * 60)
            lines.append(f"SHEET: {sheet_name}")
            lines.append("=" * 60)
            try:
                ws = wb[sheet_name]
                lines.append(f"dimensions: {ws.dimensions}")
                for row_idx, row in enumerate(ws.iter_rows(values_only=True)):
                    cells = [str(c) if c is not None else "" for c in row]
                    lines.append(f"row[{row_idx}]: {' | '.join(cells)}")
            except Exception as e:
                lines.append(f"[Could not read sheet '{sheet_name}': {e}]")

        wb.close()

    # ── legacy .xls ───────────────────────────────────────────────────────
    elif ext == ".xls":
        import xlrd

        wb = xlrd.open_workbook(input_path)
        lines.append(f"\nsheets: {wb.sheet_names()}")

        for sheet_name in wb.sheet_names():
            lines.append("\n" + "=" * 60)
            lines.append(f"SHEET: {sheet_name}")
            lines.append("=" * 60)
            try:
                ws = wb.sheet_by_name(sheet_name)
                lines.append(f"rows: {ws.nrows}  cols: {ws.ncols}")
                for row_idx in range(ws.nrows):
                    cells = [str(ws.cell_value(row_idx, c)) for c in range(ws.ncols)]
                    lines.append(f"row[{row_idx}]: {' | '.join(cells)}")
            except Exception as e:
                lines.append(f"[Could not read sheet '{sheet_name}': {e}]")

    # ── csv ───────────────────────────────────────────────────────────────
    elif ext == ".csv":
        lines.append("\n" + "=" * 60)
        lines.append("CSV CONTENT")
        lines.append("=" * 60)
        with open(input_path, "r", encoding="utf-8", errors="replace") as f:
            for row_idx, raw_line in enumerate(f):
                lines.append(f"row[{row_idx}]: {raw_line.rstrip()}")

    else:
        raise ValueError(f"Unsupported extension: {ext}. Supported: .xlsx .xlsm .xltx .xls .csv")

    return "\n".join(lines)


def _row_line(header, row):
    parts = []
    for j, cell in enumerate(row):
        if not cell.strip():
            continue
        name = header[j] if j < len(header) and header[j] else f"col{j + 1}"
        parts.append(f"{name}: {cell.strip()}")
    return " | ".join(parts)


def _sheet_pieces(sheet_name, rows, per_chunk=5, max_chars=1000):
    """rows: list of lists of strings. Header row is repeated in every chunk."""
    rows = [(i + 1, r) for i, r in enumerate(rows) if any(c.strip() for c in r)]
    if not rows:
        return []

    prefix = f"Sheet: {sheet_name}\n" if sheet_name else ""

    # header = first row with 2+ filled cells (rows above it are titles / notes)
    h = next((i for i, (_, r) in enumerate(rows) if sum(1 for c in r if c.strip()) >= 2), 0)
    header = [c.strip() for c in rows[h][1]]
    data = rows[h + 1:]

    pieces, group, size = [], [], 0

    if h > 0:
        notes = " ".join(c.strip() for _, r in rows[:h] for c in r if c.strip())
        pieces.append({
            "text": prefix + notes,
            "sheet": sheet_name,
            "rows": f"{rows[0][0]}-{rows[h - 1][0]}",
            "split": False,
        })

    def flush():
        if group:
            pieces.append({
                "text": prefix + "\n".join(line for _, line in group),
                "sheet": sheet_name,
                "rows": f"{group[0][0]}-{group[-1][0]}",
                "split": False,
            })
            group.clear()

    for num, row in data:
        line = _row_line(header, row)
        if not line:
            continue
        if group and (len(group) >= per_chunk or size + len(line) > max_chars):
            flush()
            size = 0
        group.append((num, line))
        size += len(line)
    flush()
    return pieces


def parse_excel_pieces(input_path: str) -> list:
    """Return a list of pieces: {"text", "sheet", "rows", "split"}. 5 rows per chunk, header in every chunk."""
    ext = os.path.splitext(input_path)[1].lower()
    pieces = []

    if ext in (".xlsx", ".xlsm", ".xltx"):
        import openpyxl

        wb = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
        for sheet_name in wb.sheetnames:
            rows = [
                [str(c) if c is not None else "" for c in row]
                for row in wb[sheet_name].iter_rows(values_only=True)
            ]
            pieces += _sheet_pieces(sheet_name, rows)
        wb.close()

    elif ext == ".xls":
        import xlrd

        wb = xlrd.open_workbook(input_path)
        for sheet_name in wb.sheet_names():
            ws = wb.sheet_by_name(sheet_name)
            rows = [
                [str(ws.cell_value(r, c)) for c in range(ws.ncols)]
                for r in range(ws.nrows)
            ]
            pieces += _sheet_pieces(sheet_name, rows)

    elif ext == ".csv":
        import csv

        with open(input_path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
            pieces += _sheet_pieces(None, list(csv.reader(f)))

    else:
        raise ValueError(f"Unsupported extension: {ext}. Supported: .xlsx .xlsm .xltx .xls .csv")

    return pieces


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_excel.py <filename>")
        print("Example: python parse_excel.py data.xlsx")
        sys.exit(1)

    filename = sys.argv[1].strip()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "input", filename)

    if not os.path.isfile(input_path):
        print(f"ERROR: File not found: {input_path}")
        print(f"Place '{filename}' inside the input/ folder and try again.")
        sys.exit(1)

    try:
        text = parse_excel(input_path)
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
    count = add_document(text, filename, "excel")
    print(f"Stored {count} chunks in vector DB")


if __name__ == "__main__":
    main()