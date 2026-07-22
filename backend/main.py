"""
main.py
-------
FastAPI layer for the SaaS Analytics project.

This file only wraps the existing metrics and insight logic.
All SQL / forecasting / prompt-building logic stays in the existing modules.
"""

from __future__ import annotations

import importlib
import time
from typing import Any, Optional, Protocol, cast

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import anthropic

from metrics import get_mrr_trend, get_monthly_churn, get_cohort_retention


class ExecutiveSummaryFn(Protocol):
    def __call__(
        self,
        mrr_df: Any,
        churn_df: Any,
        cohort_df: Any,
    ) -> list[dict[str, str]]: ...


def _resolve_executive_summary() -> ExecutiveSummaryFn:
    generate_insights_module = importlib.import_module("generate_insights")
    executive_summary = getattr(generate_insights_module, "generate_executive_summary")

    return cast(ExecutiveSummaryFn, executive_summary)


_generate_executive_summary = _resolve_executive_summary()


def generate_executive_summary(
    mrr_df: pd.DataFrame,
    churn_df: pd.DataFrame,
    cohort_df: pd.DataFrame,
) -> list[dict[str, str]]:
    return _generate_executive_summary(mrr_df, churn_df, cohort_df)

app = FastAPI(title="SaaS Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_PLANS = {"Starter", "Pro", "Enterprise"}

try:
    anthropic_client: Optional[anthropic.Anthropic] = anthropic.Anthropic()
except Exception:
    anthropic_client = None

_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 300


def _cache_get(key: str) -> Any | None:
    hit = _cache.get(key)
    if hit and (time.time() - hit[0]) < CACHE_TTL_SECONDS:
        return hit[1]
    return None


def _cache_set(key: str, value: Any) -> Any:
    _cache[key] = (time.time(), value)
    return value


def _normalize_plan(plan: Optional[str]) -> Optional[str]:
    if plan and plan not in VALID_PLANS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown plan '{plan}'. Must be one of {sorted(VALID_PLANS)}.",
        )
    return plan


def _records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []

    clean = df.copy()
    for col in clean.columns:
        if pd.api.types.is_integer_dtype(clean[col]):
            clean[col] = clean[col].astype(object).where(clean[col].notna(), None)
        elif pd.api.types.is_float_dtype(clean[col]):
            clean[col] = clean[col].astype(object).where(clean[col].notna(), None)

    records = cast(list[dict[str, object]], clean.to_dict(orient="records"))
    for row in records:
        for k, v in row.items():
            if isinstance(v, np.generic):
                row[k] = v.item()
    return records


def _get_mrr_cached(plan: Optional[str]) -> pd.DataFrame:
    key = f"mrr:{plan or 'all'}"
    hit = _cache_get(key)
    if hit is not None:
        return hit
    return _cache_set(key, get_mrr_trend(plan))


def _get_churn_cached(plan: Optional[str]) -> pd.DataFrame:
    key = f"churn:{plan or 'all'}"
    hit = _cache_get(key)
    if hit is not None:
        return hit
    return _cache_set(key, get_monthly_churn(plan))


def _get_cohort_cached() -> pd.DataFrame:
    key = "cohort"
    hit = _cache_get(key)
    if hit is not None:
        return hit
    return _cache_set(key, get_cohort_retention())


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/mrr-trend")
def mrr_trend(plan: Optional[str] = Query(None, description="Starter | Pro | Enterprise")):
    plan = _normalize_plan(plan)
    return _records(_get_mrr_cached(plan))


@app.get("/api/churn")
def churn(plan: Optional[str] = Query(None, description="Starter | Pro | Enterprise")):
    plan = _normalize_plan(plan)
    return _records(_get_churn_cached(plan))


@app.get("/api/cohort-retention")
def cohort_retention():
    return _records(_get_cohort_cached())


@app.get("/api/plan-breakdown")
def plan_breakdown() -> list[dict[str, str | float]]:
    rows: list[dict[str, str | float]] = []
    for plan in sorted(VALID_PLANS):
        df = _get_mrr_cached(plan)
        if df.empty:
            continue
        last_val = df["total_mrr"].iloc[-1]
        rows.append({"plan": plan, "mrr": float(last_val)})
    return rows


@app.get("/api/kpis")
def kpis(plan: Optional[str] = Query(None, description="Starter | Pro | Enterprise")) -> dict[str, float | int | None]:
    plan = _normalize_plan(plan)

    mrr_df = _get_mrr_cached(plan)
    churn_df = _get_churn_cached(plan)
    cohort_df = _get_cohort_cached()

    if mrr_df.empty:
        raise HTTPException(status_code=404, detail="No MRR data for this plan.")

    latest_mrr = float(mrr_df["total_mrr"].iloc[-1])
    previous_mrr = float(mrr_df["total_mrr"].iloc[-2]) if len(mrr_df) > 1 else latest_mrr
    mrr_growth_pct = ((latest_mrr - previous_mrr) / previous_mrr * 100) if previous_mrr else 0.0

    latest_subs = int(mrr_df["active_subscriptions"].iloc[-1])
    avg_churn = float(churn_df["churn_rate_pct"].mean()) if not churn_df.empty else None
    avg_retention_6mo = float(cohort_df["retained_6mo_pct"].mean()) if not cohort_df.empty else None

    return {
        "mrr": latest_mrr,
        "mrr_growth_pct": round(mrr_growth_pct, 1),
        "active_subscriptions": latest_subs,
        "avg_monthly_churn_pct": round(avg_churn, 1) if avg_churn is not None else None,
        "avg_6mo_retention_pct": round(avg_retention_6mo, 1) if avg_retention_6mo is not None else None,
    }


@app.get("/api/insights")
def insights(plan: Optional[str] = Query(None, description="Starter | Pro | Enterprise")):
    plan = _normalize_plan(plan)
    cache_key = f"insights:{plan or 'all'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    mrr_df = _get_mrr_cached(plan)
    churn_df = _get_churn_cached(plan)
    cohort_df = _get_cohort_cached()

    if mrr_df.empty or churn_df.empty or cohort_df.empty:
        raise HTTPException(status_code=404, detail="Not enough data to generate insights for this plan.")

    try:
        raw = generate_executive_summary(mrr_df, churn_df, cohort_df)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI insight generation failed: {e}")

    tag_color = {"Positive": "success", "Watch": "warning", "Negative": "warning"}

    shaped = [
        {
            "tag": item.get("tag", "Watch"),
            "tagColor": tag_color.get(item.get("tag", "Watch"), "warning"),
            "title": item.get("title", ""),
            "body": item.get("description", ""),
        }
        for item in raw
    ]

    return _cache_set(cache_key, shaped)


class CopilotRequest(BaseModel):
    question: str
    metrics_context: str = ""


@app.post("/api/copilot")
def copilot(req: CopilotRequest):
    if anthropic_client is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "AI copilot is not configured — ANTHROPIC_API_KEY is missing. "
                "Add it to backend/.env and restart the server."
            ),
        )

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    prompt = (
        "You are the AI Copilot inside a SaaS revenue dashboard called Northstar. "
        "Answer the user's question in 2-4 concise sentences, referencing the "
        "numbers below where relevant. Do not invent numbers that aren't given.\n\n"
        f"Live metrics: {req.metrics_context}\n\n"
        f"Question: {req.question}"
    )

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        answer_parts: list[str] = []
        for block in message.content:
            if getattr(block, "type", None) == "text":
                text = getattr(block, "text", None)
                if isinstance(text, str):
                    answer_parts.append(text)

        answer = "".join(answer_parts).strip()

        return {"answer": answer or "I couldn't generate a response just now."}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI copilot call failed: {e}")