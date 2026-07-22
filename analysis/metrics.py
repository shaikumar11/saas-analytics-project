"""
metrics.py
-----------
Connects to our PostgreSQL database and runs the three core SaaS
analyst queries: MRR trend, monthly churn rate, and cohort retention.

Returns everything as Pandas DataFrames so they can be reused by
the dashboard and the AI insights layer.
"""

import os
from typing import Optional

from sqlalchemy import create_engine, text
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_USER = "postgres"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "saas_analytics"

CONNECTION_STRING = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
engine = create_engine(CONNECTION_STRING)


def get_mrr_trend(plan: Optional[str] = None) -> pd.DataFrame:
    """Returns monthly MRR and active subscription count over time.
    If plan is given (e.g. 'Pro'), filters to just that plan."""
    plan_filter = "AND s.plan = :plan" if plan else ""
    query = text(
        f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', (SELECT MIN(start_date) FROM subscriptions)),
                date_trunc('month', (SELECT MAX(start_date) FROM subscriptions)),
                interval '1 month'
            )::date AS month
        )
        SELECT 
            m.month,
            SUM(s.mrr_amount) AS total_mrr,
            COUNT(*) AS active_subscriptions
        FROM months m
        JOIN subscriptions s
            ON s.start_date <= (m.month + interval '1 month' - interval '1 day')
            AND (s.end_date IS NULL OR s.end_date >= m.month)
            {plan_filter}
        GROUP BY m.month
        ORDER BY m.month;
    """
    )
    with engine.connect() as conn:
        params = {"plan": plan} if plan else {}
        return pd.read_sql(query, conn, params=params)


def get_monthly_churn(plan: Optional[str] = None) -> pd.DataFrame:
    """Returns monthly churn rate. If plan is given, filters to just that plan."""
    plan_filter = "AND s.plan = :plan" if plan else ""
    query = text(
        f"""
        WITH months AS (
            SELECT generate_series(
                date_trunc('month', (SELECT MIN(start_date) FROM subscriptions)),
                date_trunc('month', (SELECT MAX(start_date) FROM subscriptions)),
                interval '1 month'
            )::date AS month
        ),
        monthly_status AS (
            SELECT 
                m.month,
                s.subscription_id,
                (s.start_date < m.month) AS active_at_start,
                (s.end_date >= m.month AND s.end_date < m.month + interval '1 month') AS churned_this_month
            FROM months m
            JOIN subscriptions s
                ON s.start_date <= (m.month + interval '1 month' - interval '1 day')
                AND (s.end_date IS NULL OR s.end_date >= m.month)
                {plan_filter}
        )
        SELECT 
            month,
            SUM(CASE WHEN active_at_start THEN 1 ELSE 0 END) AS active_at_month_start,
            SUM(CASE WHEN churned_this_month THEN 1 ELSE 0 END) AS churned_in_month,
            ROUND(
                100.0 * SUM(CASE WHEN churned_this_month THEN 1 ELSE 0 END) 
                / NULLIF(SUM(CASE WHEN active_at_start THEN 1 ELSE 0 END), 0), 
            2) AS churn_rate_pct
        FROM monthly_status
        GROUP BY month
        ORDER BY month;
    """
    )
    with engine.connect() as conn:
        params = {"plan": plan} if plan else {}
        df = pd.read_sql(query, conn, params=params)
    return df.iloc[:-1] if len(df) > 1 else df


def get_cohort_retention() -> pd.DataFrame:
    """Returns 1/3/6-month retention % for each signup cohort (Starter plan)."""
    query = text(
        """
        WITH cohorts AS (
            SELECT 
                subscription_id,
                user_id,
                date_trunc('month', start_date)::date AS cohort_month,
                start_date,
                end_date
            FROM subscriptions
            WHERE plan = 'Starter'
        )
        SELECT 
            cohort_month,
            COUNT(*) AS cohort_size,
            ROUND(100.0 * SUM(CASE 
                WHEN end_date IS NULL OR end_date >= start_date + interval '1 month' 
                THEN 1 ELSE 0 END) / COUNT(*), 1) AS retained_1mo_pct,
            ROUND(100.0 * SUM(CASE 
                WHEN end_date IS NULL OR end_date >= start_date + interval '3 months' 
                THEN 1 ELSE 0 END) / COUNT(*), 1) AS retained_3mo_pct,
            ROUND(100.0 * SUM(CASE 
                WHEN end_date IS NULL OR end_date >= start_date + interval '6 months' 
                THEN 1 ELSE 0 END) / COUNT(*), 1) AS retained_6mo_pct
        FROM cohorts
        GROUP BY cohort_month
        ORDER BY cohort_month;
    """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    return df.iloc[:-3] if len(df) > 3 else df


if __name__ == "__main__":
    print("=== MRR TREND ===")
    print(get_mrr_trend())

    print("\n=== MONTHLY CHURN (last row excluded as artifact) ===")
    print(get_monthly_churn())

    print("\n=== COHORT RETENTION (last 3 cohorts excluded as artifact) ===")
    print(get_cohort_retention())