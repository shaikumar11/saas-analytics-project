"""
generate_data.py
-----------------
Generates a realistic synthetic SaaS company dataset:
  1. users.csv           - who signed up, when, what plan
  2. subscriptions.csv    - billing/revenue records, churn status
  3. feature_usage.csv    - event log of what features people used, and when

WHY SYNTHETIC DATA?
We control the ground truth. We deliberately embed a business pattern
(Starter-plan users who don't adopt "core_dashboard" early churn more)
so that later analysis steps have something real to discover and explain.
This mirrors how "activation" drives "retention" in real SaaS companies.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
np.random.seed(42)
random.seed(42)

N_USERS = 3000
START_DATE = datetime(2024, 1, 1)
END_DATE = datetime(2025, 12, 31)

PLANS = ["Free", "Starter", "Pro", "Enterprise"]
PLAN_WEIGHTS = [0.45, 0.35, 0.15, 0.05]
PLAN_MRR = {"Free": 0, "Starter": 29, "Pro": 99, "Enterprise": 499}

COUNTRIES = ["USA", "India", "UK", "Germany", "Canada", "Australia", "Brazil"]
COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"]

FEATURES = [
    "core_dashboard",
    "reports_export",
    "team_collaboration",
    "api_access",
    "custom_alerts",
    "integrations",
]


def random_date(start, end):
    delta = end - start
    random_days = random.randint(0, delta.days)
    return start + timedelta(days=random_days)


def generate_users(n_users):
    users = []
    for i in range(1, n_users + 1):
        signup_date = random_date(START_DATE, END_DATE)
        plan = np.random.choice(PLANS, p=PLAN_WEIGHTS)
        company_size = np.random.choice(COMPANY_SIZES)
        country = np.random.choice(COUNTRIES)

        users.append({
            "user_id": i,
            "signup_date": signup_date.date(),
            "plan": plan,
            "company_size": company_size,
            "country": country,
        })

    return pd.DataFrame(users)


def generate_feature_usage(users_df):
    events = []
    event_id = 1
    activation_map = {}

    for _, user in users_df.iterrows():
        signup_date = pd.to_datetime(user["signup_date"])
        plan = user["plan"]

        if plan == "Starter":
            activated = np.random.random() < 0.55
        else:
            activated = np.random.random() < 0.75

        activation_map[user["user_id"]] = activated

        if activated:
            n_events = np.random.poisson(lam=25)
        else:
            n_events = np.random.poisson(lam=6)

        for _ in range(n_events):
            max_offset_days = min(270, (END_DATE - signup_date).days)
            if max_offset_days <= 0:
                continue
            offset_days = np.random.randint(0, max_offset_days + 1)
            event_date = signup_date + timedelta(days=int(offset_days))

            if activated and offset_days <= 30 and np.random.random() < 0.4:
                feature = "core_dashboard"
            else:
                feature = np.random.choice(FEATURES)

            events.append({
                "event_id": event_id,
                "user_id": user["user_id"],
                "feature_name": feature,
                "event_date": event_date.date(),
                "usage_count": np.random.randint(1, 5),
            })
            event_id += 1

    return pd.DataFrame(events), activation_map


def generate_subscriptions(users_df, activation_map):
    subs = []
    sub_id = 1

    for _, user in users_df.iterrows():
        plan = user["plan"]
        if plan == "Free":
            continue

        signup_date = pd.to_datetime(user["signup_date"])
        mrr = PLAN_MRR[plan]
        activated = activation_map.get(user["user_id"], True)

        base_churn_prob = {"Starter": 0.18, "Pro": 0.10, "Enterprise": 0.05}[plan]

        if plan == "Starter" and not activated:
            churn_prob = base_churn_prob * 3.0
        else:
            churn_prob = base_churn_prob

        churned = np.random.random() < churn_prob

        if churned:
            days_to_churn = np.random.randint(30, 300)
            max_end = (END_DATE - signup_date).days
            end_offset = min(days_to_churn, max_end) if max_end > 0 else 0
            end_date = signup_date + timedelta(days=int(end_offset))
        else:
            end_date = None

        subs.append({
            "subscription_id": sub_id,
            "user_id": user["user_id"],
            "plan": plan,
            "mrr_amount": mrr,
            "start_date": signup_date.date(),
            "end_date": end_date.date() if end_date else None,
            "churned": churned,
        })
        sub_id += 1

    return pd.DataFrame(subs)


if __name__ == "__main__":
    users_df = generate_users(N_USERS)
    usage_df, activation_map = generate_feature_usage(users_df)
    subs_df = generate_subscriptions(users_df, activation_map)

    starter_subs = subs_df[subs_df["plan"] == "Starter"].copy()
    starter_subs["activated"] = starter_subs["user_id"].map(activation_map)

    churn_by_activation = starter_subs.groupby("activated")["churned"].mean()
    print("=== SANITY CHECK: Starter plan churn rate by activation status ===")
    print(churn_by_activation)
    print("\n(We expect 'False' - not activated - to be roughly 3x 'True')")

    users_df.to_csv("users.csv", index=False)
    usage_df.to_csv("feature_usage.csv", index=False)
    subs_df.to_csv("subscriptions.csv", index=False)

    print(f"\nSaved: users.csv ({len(users_df)} rows)")
    print(f"Saved: feature_usage.csv ({len(usage_df)} rows)")
    print(f"Saved: subscriptions.csv ({len(subs_df)} rows)")