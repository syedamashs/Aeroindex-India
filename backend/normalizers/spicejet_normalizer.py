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

def normalize_spicejet(raw: Dict[str, Any], task: Dict[str, Any]):
    rows=[]; ts=task_ts(task); ro,rd=task.get("origin"),task.get("destination")
    data=raw.get("data",{}) or {}; params=data.get("searchParams",{}) or {}
    currency=params.get("currencyCode") or params.get("currency") or "INR"
    for trip in data.get("trips",[]) or []:
      for j in (trip.get("journeys") or trip.get("journeysAvailable") or []):
        jd=j.get("designator",{}) or {}; o=jd.get("origin") or j.get("origin"); d=jd.get("destination") or j.get("destination")
        if ro and str(o).upper()!=str(ro).upper(): continue
        if rd and str(d).upper()!=str(rd).upper(): continue
        segs=j.get("segments") or []; nums=[]; carriers=[]; aircraft=[]
        for s in segs:
          ident=s.get("identifier")
          if isinstance(ident,dict): nums.append(str(ident.get("identifier") or ident.get("flightNumber") or "")); carriers.append(str(ident.get("carrierCode") or ""))
          elif ident: nums.append(str(ident)); carriers.append(str(s.get("carrierCode") or ""))
          for l in s.get("legs") or []:
            if l.get("equipmentType"): aircraft.append(str(l["equipmentType"]))
        dep,arr=jd.get("departure"),jd.get("arrival"); dur=None
        try: dur=int(round((pd.Timestamp(arr)-pd.Timestamp(dep)).total_seconds()/60))
        except Exception: pass
        fares=j.get("passengerFares") or []
        if not fares and isinstance(data.get("faresAvailable"),dict): fares=list(data["faresAvailable"].values())
        for pf in fares:
          if not isinstance(pf,dict): continue
          base=safe_float(pf.get("publishedFare") if pf.get("publishedFare") is not None else pf.get("revenueFare"))
          total=safe_float(pf.get("fareAmount")); taxes=safe_float(pf.get("TaxSum") if pf.get("TaxSum") is not None else pf.get("taxAmount"))
          fees=safe_float(pf.get("feeAmount")); key=pf.get("fareAvailabilityKey")
          row=blank(); row.update({
            "observation_id":stable_id("spicejet",task.get("run_id"),task.get("task_id"),o,d,dep,j.get("journeyKey"),pf.get("productClass"),pf.get("fareClass"),total),
            "source":"spicejet","source_url":task.get("source_url"),"search_timestamp":ts,"extraction_status":"success","currency":currency,
            "origin":o,"destination":d,"departure_datetime":iso(dep),"arrival_datetime":iso(arr),"departure_utc":utc_iso(dep),"arrival_utc":utc_iso(arr),
            "duration_minutes":dur,"flight_number":",".join(dict.fromkeys([x for x in nums if x])) or None,
            "carrier_code":",".join(dict.fromkeys([x for x in carriers if x])) or "SG","marketing_airline":"SpiceJet",
            "operating_airline":pf.get("operatingCarrier") or "SpiceJet","flight_id":j.get("journeyKey"),
            "journey_id":j.get("journeyKey"),"aircraft_code":",".join(dict.fromkeys(aircraft)) or None,
            "stops":safe_int(j.get("stops")) if j.get("stops") is not None else max(len(segs)-1,0),"flight_type":j.get("flightType"),
            "fare_product_class":pf.get("productClass"),"fare_class":pf.get("FareClassOfService") or pf.get("classOfService") or pf.get("fareClass"),
            "fare_family":pf.get("fareCode"),"source_offer_id":key,"fare_availability_key":key,"base_fare":base,"taxes":taxes,"total_fees":fees,
            "total_fare":total,"is_sold":j.get("isSold"),"service_charges":json.dumps(pf.get("serviceCharges"),default=str),
            "original_fare_amount":total,"original_published_amount":safe_float(pf.get("publishedFare")),"passenger_type":"ADT"
          }); rows.append(row)
    return finalize(rows,task)
