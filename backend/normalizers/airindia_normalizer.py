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
    if df.empty: return []
    df["extraction_status"] = df["extraction_status"].fillna("success")
    df["currency"] = df["currency"].fillna("INR")
    for c in ["duration_minutes","stops","base_fare","taxes","total_fees",
              "total_fare","original_fare_amount","original_published_amount",
              "original_total_discount"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in ["is_cheapest_offer","is_sold","filling_fast"]:
        df[c] = df[c].map(lambda x: x if isinstance(x,bool) else
            (str(x).lower() in {"true","1","yes"} if x is not None and not pd.isna(x) else None))
    return df[APIX_COLUMNS].to_dict(orient="records")

def task_ts(task):
    return task.get("search_timestamp") or task.get("collection_timestamp") or datetime.now(timezone.utc).isoformat()

def normalize_airindia(raw: Dict[str, Any], task: Dict[str, Any]):
    rows=[]; ts=task_ts(task)
    ro, rd = task.get("origin"), task.get("destination")
    flights=(raw.get("dictionaries") or {}).get("flight",{}) or {}
    services=(raw.get("dictionaries") or {}).get("service",{}) or {}
    for payload in raw.get("responsePayload",[]) or []:
      for group in payload.get("airBoundGroups",[]) or []:
        bd=group.get("boundDetails",{}) or {}; o=bd.get("originLocationCode"); d=bd.get("destinationLocationCode")
        if ro and str(o).upper()!=str(ro).upper(): continue
        if rd and str(d).upper()!=str(rd).upper(): continue
        for bound in group.get("airBounds",[]) or []:
          offer=bound.get("airOffer",{}) or {}; prices=offer.get("prices",{}) or {}
          ps=prices.get("totalPrices") or []
          if not ps: continue
          p=ps[0] or {}; base=safe_float(p.get("base")); taxes=safe_float(p.get("totalTaxes"))
          fees=safe_float(p.get("totalFees")); total=safe_float(p.get("total"))
          fis=bound.get("fareInfos") or [{}]
          for fi in fis:
            fids=fi.get("flightIds") or []
            if not fids:
              fids=[a.get("flightId") for a in (bound.get("availabilityDetails") or []) if a.get("flightId")]
            if not fids: fids=[None]
            for fid in fids:
              f=flights.get(fid,{}) if fid else {}
              dep=f.get("departure"); arr=f.get("arrival")
              dep=dep.get("dateTime") if isinstance(dep,dict) else dep
              arr=arr.get("dateTime") if isinstance(arr,dict) else arr
              dur=safe_int(f.get("duration")); dur=dur//60 if dur and dur>1000 else dur
              row=blank(); row.update({
                "observation_id":stable_id("airindia",task.get("run_id"),task.get("task_id"),o,d,fid,fi.get("fareClass"),total),
                "source":"airindia","source_url":task.get("source_url"),"search_timestamp":ts,
                "extraction_status":"success","currency":p.get("currencyCode") or "INR",
                "origin":o,"destination":d,"departure_datetime":iso(dep),"arrival_datetime":iso(arr),
                "departure_utc":utc_iso(dep),"arrival_utc":utc_iso(arr),"duration_minutes":dur,
                "flight_number":f.get("marketingFlightNumber"),"carrier_code":f.get("marketingAirlineCode"),
                "marketing_airline":f.get("marketingAirlineCode"),"operating_airline":f.get("operatingAirlineCode"),
                "flight_id":fid,"journey_id":bound.get("airBoundId"),"aircraft_code":f.get("aircraftCode"),
                "stops":0,"flight_type":"NonStop","departure_terminal":f.get("departureTerminal"),
                "arrival_terminal":f.get("arrivalTerminal"),
                "code_share_indicator": (f.get("marketingAirlineCode")!=f.get("operatingAirlineCode")
                    if f.get("operatingAirlineCode") else None),
                "fare_product_class":fi.get("cabin") or fi.get("fareCabinName"),
                "fare_class":fi.get("fareClass") or fi.get("bookingClass"),
                "fare_family":fi.get("fareType"),"source_offer_id":bound.get("airBoundId"),
                "fare_availability_key":fi.get("fareAvailabilityKey"),"base_fare":base,"taxes":taxes,
                "total_fees":fees,"total_fare":total,
                "is_cheapest_offer":offer.get("isCheapestOffer"),
                "service_charges":json.dumps(fi.get("serviceIds"),default=str) if fi.get("serviceIds") else None,
                "original_fare_amount":total,"original_published_amount":base,"passenger_type":"ADT"
              }); rows.append(row)
    return finalize(rows,task)
