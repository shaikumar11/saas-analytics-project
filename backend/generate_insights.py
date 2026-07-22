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
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_executive_summary(mrr_df, churn_df, cohort_df):
    """
    Returns a list of 3 structured insight dicts:
    [{"title": ..., "tag": "Positive"|"Watch"|"Negative", "description": ...}, ...]
    """
    latest_mrr = mrr_df["total_mrr"].iloc[-1]
    mrr_12mo_ago = mrr_df["total_mrr"].iloc[-13] if len(mrr_df) > 12 else mrr_df["total_mrr"].iloc[0]
    mrr_yoy_growth = ((latest_mrr - mrr_12mo_ago) / mrr_12mo_ago) * 100

    avg_churn = churn_df["churn_rate_pct"].mean()
    latest_churn = churn_df["churn_rate_pct"].iloc[-1]
    avg_retention_1mo = cohort_df["retained_1mo_pct"].mean()
    avg_retention_6mo = cohort_df["retained_6mo_pct"].mean()

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
        messages=[{
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
            """
        }]
    )

    result = json.loads(response.choices[0].message.content)
    return result["insights"]


if __name__ == "__main__":
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), "..", "analysis"))
    from metrics import get_mrr_trend, get_monthly_churn, get_cohort_retention

    mrr_df = get_mrr_trend()
    churn_df = get_monthly_churn()
    cohort_df = get_cohort_retention()

    insights = generate_executive_summary(mrr_df, churn_df, cohort_df)
    for i in insights:
        print(f"[{i['tag']}] {i['title']}: {i['description']}\n")
