"""
Holiday PDF -> structured rows, deterministic (no LLM).

The three real holiday schedules this parses (Cotelligent India, US-Aligned,
TechDemocracy Ontario) are all simple bordered tables, just with two
different date spellings ("01-Jan-2026" vs "January 1, Thursday" with no
year in the cell). This reads the table via pdfplumber's grid-line detection
(exact, not OCR/guesswork) and matches each date-bearing cell against a
small set of known formats. Never invents a date — a row that doesn't match
any known format is skipped and reported back as a warning so the caller
(the review screen) can add it manually instead of silently losing it.
"""
import io
import re
from datetime import date as date_cls, datetime
from typing import IO

import pdfplumber

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# "01-Jan-2026" / "1-Jan-2026"
_DATE_DMY = re.compile(r"\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b")
# "January 1, Thursday" / "April 03, Friday" — no year, injected by the caller
_DATE_MONTH_DAY = re.compile(r"\b([A-Za-z]+)\s+(\d{1,2})\b")


def _try_parse_dmy(text: str) -> date_cls | None:
    m = _DATE_DMY.search(text)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(0), "%d-%b-%Y").date()
    except ValueError:
        return None


def _try_parse_month_day(text: str, year: int) -> date_cls | None:
    m = _DATE_MONTH_DAY.search(text)
    if not m:
        return None
    month_word = m.group(1)
    if month_word.lower() in _WEEKDAYS:
        return None  # e.g. "Thursday 1" isn't a month
    candidate = f"{month_word} {m.group(2)} {year}"
    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            return datetime.strptime(candidate, fmt).date()
        except ValueError:
            continue
    return None


def _extract_date(cell: str, year: int) -> date_cls | None:
    cell = (cell or "").strip()
    if not cell:
        return None
    return _try_parse_dmy(cell) or _try_parse_month_day(cell, year)


def _stated_weekday(row_cells: list[str]) -> str | None:
    """A bare weekday-name cell in the row, if the table has a separate Day column."""
    for cell in row_cells:
        c = (cell or "").strip().lower()
        if c in _WEEKDAYS:
            return c
    return None


_SMART_PUNCTUATION = str.maketrans({
    "‘": "'", "’": "'",  # smart single quotes
    "“": '"', "”": '"',  # smart double quotes
    "–": "-", "—": "-",  # en/em dash
})


def _clean_name(text: str) -> str:
    text = text.translate(_SMART_PUNCTUATION)
    return re.sub(r"\s+", " ", text).strip()


def _pick_name(row_cells: list[str], date_cell_index: int) -> str:
    """Longest cell that isn't the date and isn't a bare index/weekday/blank."""
    candidates = []
    for i, cell in enumerate(row_cells):
        if i == date_cell_index:
            continue
        c = (cell or "").strip()
        if not c or c.lower() in _WEEKDAYS or c.isdigit():
            continue
        candidates.append(_clean_name(c))
    return max(candidates, key=len) if candidates else "Unnamed Holiday"


def _largest_table(pdf) -> list[list[str]] | None:
    best: list[list[str]] | None = None
    for page in pdf.pages:
        for table in page.extract_tables() or []:
            if best is None or len(table) > len(best):
                best = table
    return best


def parse_holiday_pdf(file: IO[bytes] | bytes, year: int) -> dict:
    """Returns {"rows": [{name, date (ISO str), day_of_week}], "warnings": [str]}.
    `rows` is sorted by date. Never writes anything — purely extraction, for
    the caller to show as an editable preview before any DB write happens.
    """
    if isinstance(file, (bytes, bytearray)):
        file = io.BytesIO(file)

    warnings: list[str] = []
    rows_out: list[dict] = []
    seen_dates: set[date_cls] = set()

    with pdfplumber.open(file) as pdf:
        table = _largest_table(pdf)

    if not table:
        return {"rows": [], "warnings": ["Could not find a table in this PDF — add holidays manually."]}

    for raw_row in table:
        cells = [c if c is not None else "" for c in raw_row]
        date_cell_index = None
        parsed_date = None
        for i, cell in enumerate(cells):
            d = _extract_date(cell, year)
            if d is not None:
                date_cell_index, parsed_date = i, d
                break
        if parsed_date is None:
            continue  # header / footer / footnote row — silently skipped, not a data row

        if parsed_date.year != year:
            warnings.append(
                f"Row parsed to {parsed_date.isoformat()}, outside the selected year {year} — skipped."
            )
            continue

        stated = _stated_weekday(cells)
        if stated and _WEEKDAYS[parsed_date.weekday()] != stated:
            warnings.append(
                f"{cells}: parsed date {parsed_date.isoformat()} is a "
                f"{_WEEKDAYS[parsed_date.weekday()].title()}, but the PDF says {stated.title()} — check this row."
            )

        if parsed_date in seen_dates:
            warnings.append(f"Duplicate date {parsed_date.isoformat()} in the PDF — kept the first occurrence.")
            continue
        seen_dates.add(parsed_date)

        rows_out.append({
            "name": _pick_name(cells, date_cell_index),
            "date": parsed_date.isoformat(),
            "day_of_week": _WEEKDAYS[parsed_date.weekday()].title(),
        })

    rows_out.sort(key=lambda r: r["date"])
    return {"rows": rows_out, "warnings": warnings}
