# iSmartRAG — Backend Parsers

Quick-start reference for all four parsing pipelines.

---

## Folder Structure

```
backend/
├── ppt/
│   ├── input/          ← Drop your .pptx files here
│   ├── output/         ← Parsed output lands here (auto date-stamped)
│   └── parse_ppt.py
│
├── word/
│   ├── input/          ← Drop your .docx files here
│   ├── output/         ← Parsed output lands here (auto date-stamped)
│   └── parse_word.py
│
├── excel/
│   ├── input/          ← Drop your .xlsx / .xls / .csv files here
│   ├── output/         ← Parsed output lands here (auto date-stamped)
│   └── parse_excel.py
│
└── website/
    ├── output/         ← Saved HTML files land here (auto date-stamped)
    └── scrape.py
```

---

## Commands

### Website — scrape and save full HTML
```bash
cd backend/website
python scrape.py https://example.com
```
Output: `output/example_com__20240915_143022.html`

---

### PPT — parse a PowerPoint
```bash
cd backend/ppt
# 1. Copy your file into input/
# 2. Run:
python parse_ppt.py my_presentation.pptx
```
Output: `output/my_presentation__20240915_143022.txt`
Extracts: slide titles, body text, tables, chart titles, speaker notes, core properties.

---

### Word — parse a Word document
```bash
cd backend/word
# 1. Copy your file into input/
# 2. Run:
python parse_word.py report.docx
```
Output: `output/report__20240915_143022.txt`
Extracts: headings, paragraphs, tables, core properties (author, title, dates).

---

### Excel — parse a spreadsheet
```bash
cd backend/excel
# 1. Copy your file into input/
# 2. Run:
python parse_excel.py data.xlsx   # also works with .xls and .csv
```
Output: `output/data__20240915_143022.txt`
Extracts: all sheets, all rows, aligned column layout.

---

## Dependencies

Scripts auto-install their dependencies on first run if missing.
To install everything upfront:

```bash
pip install python-pptx python-docx openpyxl pandas
```

---

## Output Naming Convention

All output files follow the pattern:

```
<original_filename_without_extension>__<YYYYMMDD_HHMMSS>.<ext>
```

This means re-running a script on the same file never overwrites the previous result.
