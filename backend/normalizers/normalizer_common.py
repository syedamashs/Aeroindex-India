from __future__ import annotations
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict
import json, math
import pandas as pd

APIX_COLUMNS = [
    "observation_id","source","source_url","search_timestamp","extraction_status",
    "currency","origin","destination","origin_city","destination_city",
    "departure_datetime","arrival_datetime","departure_utc","arrival_utc",
    "duration_minutes","flight_number","carrier_code","marketing_airline",
    "operating_airline","flight_id","journey_id","aircraft_code","stops",
    "flight_type","departure_terminal","arrival_terminal","code_share_indicator",
    "schedule_service_type","fare_product_class","fare_class","fare_family",
    "source_offer_id","fare_availability_key","base_fare","taxes","total_fees",
    "total_fare","is_cheapest_offer","is_sold","filling_fast","service_charges",
    "original_fare_amount","original_published_amount","original_total_discount",
    "passenger_type",
]

def safe_float(v):
    if v is None or v == "": return None
    try:
        x = float(v); return x if math.isfinite(x) else None
    except (TypeError, ValueError): return None

def safe_int(v):
    if v is None or v == "": return None
    try: return int(v)
    except (TypeError, ValueError):
        try: return int(float(v))
        except (TypeError, ValueError): return None

def iso(v):
    if v is None or v == "": return None
    try: return pd.Timestamp(v).isoformat()
    except Exception: return str(v)

def utc_iso(v):
    if v is None or v == "": return None
    try:
        t = pd.Timestamp(v)
        return t.tz_convert("UTC").isoformat() if t.tzinfo is not None else t.isoformat()
    except Exception: return None

def stable_id(*parts):
    s = "|".join("" if x is None else str(x) for x in parts)
    return sha256(s.encode()).hexdigest()[:32]

def blank(): return {c: None for c in APIX_COLUMNS}

def finalize(rows, task):
    df = pd.DataFrame(rows, columns=APIX_COLUMNS)
    if df.empty: return df
    df["extraction_status"] = df["extraction_status"].fillna("success")
    df["currency"] = df["currency"].fillna("INR")
    for c in ["duration_minutes","stops","base_fare","taxes","total_fees",
              "total_fare","original_fare_amount","original_published_amount",
              "original_total_discount"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in ["is_cheapest_offer","is_sold","filling_fast"]:
        df[c] = df[c].map(lambda x: x if isinstance(x,bool) else
            (str(x).lower() in {"true","1","yes"} if x is not None and not pd.isna(x) else None))
    return df[APIX_COLUMNS]

def task_ts(task):
    return task.get("search_timestamp") or task.get("collection_timestamp") or datetime.now(timezone.utc).isoformat()
