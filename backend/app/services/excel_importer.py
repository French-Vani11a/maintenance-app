import re
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd


def get_sheet_names(file_path: str) -> List[str]:
    xl = pd.ExcelFile(file_path)
    return xl.sheet_names


def _parse_downtime_to_minutes(value: Any) -> int:
    """
    Convert a variety of downtime representations to integer minutes.
    Handles: numeric minutes/hours, "2:30", "2h 30m", "150 min", etc.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0
    if isinstance(value, (int, float)):
        # Match string parsing: small values are hours, larger values are minutes.
        return int(value * 60) if value <= 24 else int(value)

    text = str(value).strip()
    if not text or text.lower() in ("nan", "none", "-", "n/a"):
        return 0

    # HH:MM  or  H:MM
    m = re.match(r"^(\d+):(\d{2})$", text)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))

    # Pure integer / float string — interpret as minutes if > 24, else hours
    m = re.match(r"^(\d+(?:\.\d+)?)$", text)
    if m:
        num = float(m.group(1))
        return int(num * 60) if num <= 24 else int(num)

    # "2h 30m", "2hrs 30min", "2 hours 30 minutes"
    hours_m = re.search(r"(\d+)\s*h", text, re.IGNORECASE)
    mins_m = re.search(r"(\d+)\s*m(?:in)?", text, re.IGNORECASE)
    hours = int(hours_m.group(1)) if hours_m else 0
    minutes = int(mins_m.group(1)) if mins_m else 0
    if hours or minutes:
        return hours * 60 + minutes

    # "90 minutes" / "90min"
    m = re.match(r"^(\d+)\s*min", text, re.IGNORECASE)
    if m:
        return int(m.group(1))

    return 0


def _parse_time_to_minutes(value: Any) -> int | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text or text.lower() in ("nan", "none", "-", "n/a"):
        return None

    if " " in text:
        text = text.split(" ")[-1]

    m = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", text)
    if not m:
        return None

    hours = int(m.group(1))
    minutes = int(m.group(2))
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None

    return hours * 60 + minutes


def _compute_downtime_from_times(arrival_time: Any, finishing_time: Any) -> int | None:
    arrival = _parse_time_to_minutes(arrival_time)
    finishing = _parse_time_to_minutes(finishing_time)
    if arrival is None or finishing is None:
        return None
    if finishing >= arrival:
        return finishing - arrival
    return (24 * 60 - arrival) + finishing


# Flexible column name mappings (order matters – first match wins)
_COL_ALIASES: Dict[str, List[str]] = {
    "date": ["date", "record date", "reported date", "fault date"],
    "time_reported": ["time reported", "time rep", "time"],
    "reporter_name": ["reported by", "reported by name", "reporter", "name of reporter"],
    "reported_to": ["reported to", "supervisor", "foreman"],
    "artisan_name": ["artisan name", "artisan", "technician", "mechanic", "repairer"],
    "mr_no": ["mr no.", "mr no", "mr#", "mr number", "mr_no", "mr", "maintenance request"],
    "plant": ["plant", "department", "section", "area"],
    "equipment_group": ["equipment group", "group", "equipment group name", "asset group", "category"],
    "equipment": ["equipment name", "equipment", "machine name", "machine", "asset", "asset name"],
    "issue_description": [
        "fault description", "issue description", "issue", "description",
        "problem", "fault", "defect", "comment", "comments",
    ],
    "arrival_time": ["arrival time", "time of arrival", "arrived", "arrival"],
    "finishing_time": ["finishing time", "finish time", "completed", "time finished", "finished"],
    "downtime": ["downtime", "down time", "duration", "hrs down", "hours down"],
    "run_time": ["run time", "runtime", "running time", "run hours", "machine run time"],
    "remarks": ["remarks", "notes", "observation"],
    "record_type": ["record type", "type", "maintenance type", "fault type", "call type"],
}


def _detect_columns(columns: List[str]) -> Dict[str, str]:
    """Return a mapping of field_name -> actual column name."""
    lower_cols = {c.lower().strip(): c for c in columns}
    mapping: Dict[str, str] = {}
    for field, aliases in _COL_ALIASES.items():
        for alias in aliases:
            if alias in lower_cols:
                mapping[field] = lower_cols[alias]
                break
        if field not in mapping:
            # Partial match fallback
            for alias in aliases:
                for lc, orig in lower_cols.items():
                    if alias in lc:
                        mapping[field] = orig
                        break
                if field in mapping:
                    break
    return mapping


def parse_excel_maintenance_records(
    file_path: str,
    sheet_name: str = None,
) -> List[Dict[str, Any]]:
    """Parse a maintenance log Excel sheet into a list of record dicts."""
    if sheet_name is None:
        sheet_name = get_sheet_names(file_path)[0]

    # Try reading with header=0 first, then scan for header row
    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
    except Exception as exc:
        raise ValueError(f"Cannot read sheet '{sheet_name}': {exc}")

    # If the first row looks like it isn't a header, scan for the real header
    header_cols = [str(c).lower() for c in df.columns]
    has_date = any("date" in c for c in header_cols)
    has_fault = any(
        word in " ".join(header_cols)
        for word in ("fault", "equipment", "mr", "artisan", "downtime")
    )

    if not (has_date and has_fault):
        # Scan up to first 20 rows for a better header
        raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
        found_row = None
        for idx, row in raw.iterrows():
            row_text = " ".join(str(v).lower() for v in row.values if not pd.isna(v))
            if "date" in row_text and (
                "fault" in row_text or "equipment" in row_text or "mr" in row_text
            ):
                found_row = idx
                break
            if idx > 20:
                break
        if found_row is not None:
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=found_row)

    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]
    col_map = _detect_columns(list(df.columns))

    if "date" not in col_map:
        raise ValueError(
            "Could not find a 'Date' column. "
            "Please ensure the sheet has a column named 'Date' or 'Record Date'."
        )

    records: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        # Skip completely empty rows
        if all(pd.isna(v) or str(v).strip() == "" for v in row.values):
            continue

        date_val = row.get(col_map["date"])
        if pd.isna(date_val) or str(date_val).strip() in ("", "nan"):
            continue

        try:
            if isinstance(date_val, datetime):
                record_date = date_val
            else:
                record_date = pd.to_datetime(str(date_val), dayfirst=True)
        except Exception:
            continue  # skip rows with unparseable dates

        record: Dict[str, Any] = {"record_date": record_date}

        for field, col in col_map.items():
            if field in ("date", "downtime", "run_time"):
                continue
            val = row.get(col)
            if pd.isna(val) or str(val).strip() in ("", "nan"):
                record[field] = None
            else:
                record[field] = str(val).strip()

        # Downtime
        if "downtime" in col_map:
            record["downtime_minutes"] = _parse_downtime_to_minutes(row.get(col_map["downtime"]))
        else:
            record["downtime_minutes"] = 0

        if "run_time" in col_map:
            run_time = _parse_downtime_to_minutes(row.get(col_map["run_time"]))
            record["run_time_minutes"] = run_time if run_time > 0 else None
        else:
            record["run_time_minutes"] = None

        computed_downtime = _compute_downtime_from_times(
            record.get("arrival_time"),
            record.get("finishing_time"),
        )
        if computed_downtime is not None:
            record["downtime_minutes"] = computed_downtime

        record.setdefault("status", "closed")  # imported records are assumed closed

        # Normalise record_type — accept regular/breakdown case-insensitively, default to regular
        raw_type = record.get("record_type")
        if raw_type:
            normalised = str(raw_type).strip().lower()
            record["record_type"] = normalised if normalised in ("regular", "breakdown") else "regular"
        else:
            record["record_type"] = "regular"

        records.append(record)

    # Validate: every row must have an equipment name
    missing_rows = [
        i + 1  # 1-based data-row number
        for i, r in enumerate(records)
        if not r.get("equipment")
    ]
    if missing_rows:
        sample = ", ".join(str(n) for n in missing_rows[:10])
        extra = f" and {len(missing_rows) - 10} more" if len(missing_rows) > 10 else ""
        raise ValueError(
            f"Equipment is required for every record. "
            f"Missing on data row(s): {sample}{extra}. "
            f"Please fill in the Equipment column and re-upload."
        )

    return records
