"""
generate_insights.py
---------------------
Takes computed metrics (already calculated by our SQL/Pandas layer) and
asks an LLM to generate structured, dashboard-ready insight cards.

IMPORTANT DESIGN PRINCIPLE:
We never send raw data to the AI. We send a small, precise SUMMARY of
numbers we already calculated ourselves. The AI's job is turning correct
numbers into clear language and structure - not doing the math.
"""

import os
import json
from importlib.util import module_from_spec, spec_from_file_location

import pandas as pd
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set — check your .env file")

client = Groq(api_key=GROQ_API_KEY)


def _get_numeric_series(series: pd.Series) -> pd.Series:
    numeric_series = pd.to_numeric(series, errors="coerce")
    return numeric_series.dropna()


def generate_executive_summary(
    mrr_df: pd.DataFrame,
    churn_df: pd.DataFrame,
    cohort_df: pd.DataFrame,
) -> list[dict[str, str]]:
    mrr_series = _get_numeric_series(mrr_df["total_mrr"])
    churn_series = _get_numeric_series(churn_df["churn_rate_pct"])
    retention_1mo_series = _get_numeric_series(cohort_df["retained_1mo_pct"])
    retention_6mo_series = _get_numeric_series(cohort_df["retained_6mo_pct"])

    if mrr_series.empty:
        raise ValueError("mrr_df['total_mrr'] has no valid numeric values")

    if churn_series.empty or retention_1mo_series.empty or retention_6mo_series.empty:
        raise ValueError("One or more retention/churn columns have no valid numeric values")

    latest_mrr: float = float(mrr_series.iloc[-1])
    mrr_12mo_ago: float = float(
        mrr_series.iloc[-13] if len(mrr_series) > 12 else mrr_series.iloc[0]
    )

    if mrr_12mo_ago == 0:
        mrr_yoy_growth: float = 0.0
    else:
        mrr_yoy_growth = ((latest_mrr - mrr_12mo_ago) / mrr_12mo_ago) * 100

    avg_churn: float = float(churn_series.to_numpy(dtype=float).mean())
    latest_churn: float = float(churn_series.iloc[-1])
    avg_retention_1mo: float = float(retention_1mo_series.to_numpy(dtype=float).mean())
    avg_retention_6mo: float = float(retention_6mo_series.to_numpy(dtype=float).mean())

    summary_facts = f"""
    - Current MRR: ${latest_mrr:,.0f}, up {mrr_yoy_growth:.0f}% year-over-year
    - Average monthly churn rate: {avg_churn:.1f}%
    - Most recent month's churn rate: {latest_churn:.1f}%
    - Average 1-month cohort retention: {avg_retention_1mo:.1f}%
    - Average 6-month cohort retention: {avg_retention_6mo:.1f}%
    - Known pattern: Starter-plan users who use the "core_dashboard" feature
      within their first 30 days churn at roughly half the rate of those who don't
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=500,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "user",
                "content": f"""You are a SaaS business analyst. Using ONLY the
                facts below, generate exactly 3 key insights for a leadership
                dashboard. Do not invent any numbers not given below.

                Respond ONLY with valid JSON in this exact structure:
                {{"insights": [
                    {{"title": "short 3-5 word title", "tag": "Positive" or "Watch" or "Negative", "description": "1-2 sentence explanation with specific numbers"}},
                    ...
                ]}}

                Facts:
                {summary_facts}
                """,
            }
        ],
    )

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq API returned an empty response")

    result = json.loads(content)
    return result["insights"]


if __name__ == "__main__":
    analysis_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "analysis"))
    metrics_path = os.path.join(analysis_dir, "metrics.py")

    if not os.path.exists(metrics_path):
        raise FileNotFoundError(f"metrics module not found at: {metrics_path}")

    metrics_spec = spec_from_file_location("metrics", metrics_path)
    if metrics_spec is None or metrics_spec.loader is None:
        raise ImportError(f"Unable to load metrics module from: {metrics_path}")

    metrics_module = module_from_spec(metrics_spec)
    metrics_spec.loader.exec_module(metrics_module)

    get_mrr_trend = metrics_module.get_mrr_trend
    get_monthly_churn = metrics_module.get_monthly_churn
    get_cohort_retention = metrics_module.get_cohort_retention

    mrr_df = get_mrr_trend()
    churn_df = get_monthly_churn()
    cohort_df = get_cohort_retention()

    insights = generate_executive_summary(mrr_df, churn_df, cohort_df)
    for item in insights:
        print(f"[{item['tag']}] {item['title']}: {item['description']}\n")