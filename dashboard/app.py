"""
app.py
------
Streamlit dashboard for the SaaS Product Analytics project.
Run with: streamlit run dashboard/app.py
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "analysis"))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "ai_insights"))

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
from metrics import get_mrr_trend, get_monthly_churn, get_cohort_retention
from generate_insights import generate_executive_summary

# ---------------------------------------------------------------------------
# PAGE CONFIG + DARK THEME
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="SaaS Analytics Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

PRIMARY = "#6366F1"
SECONDARY = "#22D3EE"
DANGER = "#F87171"
SUCCESS = "#34D399"
WARNING = "#FBBF24"
BG_CARD = "#161B29"
BG_APP = "#0B0F19"
BORDER = "#252B3B"
TEXT_MUTED = "#8B93A7"

st.markdown(f"""
    <style>
        .stApp {{ background-color: {BG_APP}; }}
        .main {{ padding-top: 1rem; }}
        [data-testid="stMetric"], .insight-card {{
            background-color: {BG_CARD};
            border: 1px solid {BORDER};
            border-radius: 12px;
            padding: 18px 20px;
        }}
        [data-testid="stMetricLabel"] {{ color: {TEXT_MUTED}; font-size: 13px; }}
        [data-testid="stMetricValue"] {{ color: #F1F5F9; }}
        h1, h2, h3, h4 {{ color: #F1F5F9 !important; }}
        p, span, label {{ color: #E2E8F0; }}
        [data-testid="stSidebar"] {{ background-color: {BG_CARD}; }}
        .stTabs [data-baseweb="tab-list"] {{ gap: 8px; }}
        .stTabs [data-baseweb="tab"] {{ border-radius: 8px 8px 0 0; padding: 10px 20px; }}
        .badge {{
            display: inline-block; padding: 3px 10px; border-radius: 20px;
            font-size: 12px; font-weight: 600; margin-bottom: 8px;
        }}
        .badge-positive {{ background-color: rgba(52,211,153,0.15); color: {SUCCESS}; }}
        .badge-watch {{ background-color: rgba(251,191,36,0.15); color: {WARNING}; }}
        .badge-negative {{ background-color: rgba(248,113,113,0.15); color: {DANGER}; }}
    </style>
""", unsafe_allow_html=True)

CHART_TEMPLATE = "plotly_dark"


# ---------------------------------------------------------------------------
# SIDEBAR (with filter)
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 📊 SaaS Analytics")
    st.caption("Internal Product & Revenue Dashboard")
    st.divider()

    plan_filter = st.selectbox(
        "Filter by Plan",
        options=["All Plans", "Starter", "Pro", "Enterprise"],
        index=0
    )

    st.divider()
    st.markdown("**Data window:** Jan 2024 – Dec 2025")
    st.divider()
    st.caption("Built by Umar · Python, PostgreSQL, Streamlit")

selected_plan = None if plan_filter == "All Plans" else plan_filter


# ---------------------------------------------------------------------------
# LOAD DATA (cached PER plan selection)
# ---------------------------------------------------------------------------
@st.cache_data
def load_data(plan):
    return get_mrr_trend(plan), get_monthly_churn(plan), get_cohort_retention()

mrr_df, churn_df, cohort_df = load_data(selected_plan)


# ---------------------------------------------------------------------------
# HEADER
# ---------------------------------------------------------------------------
st.title("SaaS Product Analytics")
st.caption(f"Revenue, churn, and retention — {plan_filter}")


# ---------------------------------------------------------------------------
# KPI ROW
# ---------------------------------------------------------------------------
latest_mrr = mrr_df["total_mrr"].iloc[-1]
previous_mrr = mrr_df["total_mrr"].iloc[-2]
mrr_growth = ((latest_mrr - previous_mrr) / previous_mrr) * 100

latest_subs = mrr_df["active_subscriptions"].iloc[-1]
avg_churn = churn_df["churn_rate_pct"].mean()
avg_retention_6mo = cohort_df["retained_6mo_pct"].mean()

col1, col2, col3, col4 = st.columns(4)
col1.metric("Monthly Recurring Revenue", f"${latest_mrr:,.0f}", f"{mrr_growth:+.1f}%")
col2.metric("Active Subscriptions", f"{latest_subs:,}")
col3.metric("Avg Monthly Churn", f"{avg_churn:.1f}%")
col4.metric("Avg 6-Month Retention", f"{avg_retention_6mo:.1f}%")


# ---------------------------------------------------------------------------
# AI INSIGHT CARDS (cached per plan selection)
# ---------------------------------------------------------------------------
st.markdown("#### 🤖 AI-Generated Insights")

summary_key = f"ai_insights_{plan_filter}"
with st.spinner("Generating insights..."):
    if summary_key not in st.session_state:
        st.session_state[summary_key] = generate_executive_summary(mrr_df, churn_df, cohort_df)

insights = st.session_state[summary_key]

badge_class = {"Positive": "badge-positive", "Watch": "badge-watch", "Negative": "badge-negative"}

card_cols = st.columns(3)
for col, insight in zip(card_cols, insights):
    tag = insight.get("tag", "Watch")
    with col:
        st.markdown(f"""
            <div class="insight-card">
                <span class="badge {badge_class.get(tag, 'badge-watch')}">{tag}</span>
                <h4 style="margin: 4px 0;">{insight['title']}</h4>
                <p style="color: {TEXT_MUTED}; font-size: 14px;">{insight['description']}</p>
            </div>
        """, unsafe_allow_html=True)

st.divider()


# ---------------------------------------------------------------------------
# DONUT CHART: MRR breakdown by plan (only shown when viewing All Plans)
# ---------------------------------------------------------------------------
if selected_plan is None:
    st.markdown("#### Revenue Breakdown by Plan")

    @st.cache_data
    def load_plan_breakdown():
        plans = ["Starter", "Pro", "Enterprise"]
        rows = []
        for p in plans:
            df = get_mrr_trend(p)
            rows.append({"plan": p, "mrr": df["total_mrr"].iloc[-1]})
        return rows

    breakdown = load_plan_breakdown()
    donut_fig = go.Figure(data=[go.Pie(
        labels=[r["plan"] for r in breakdown],
        values=[r["mrr"] for r in breakdown],
        hole=0.6,
        marker=dict(colors=[PRIMARY, SECONDARY, SUCCESS])
    )])
    donut_fig.update_layout(template=CHART_TEMPLATE, height=350, margin=dict(t=20),
                            paper_bgcolor=BG_APP, plot_bgcolor=BG_APP)
    st.plotly_chart(donut_fig, width="stretch")
    st.divider()


# ---------------------------------------------------------------------------
# TABS
# ---------------------------------------------------------------------------
tab1, tab2, tab3 = st.tabs(["📈 Revenue", "⚠️ Churn", "🔁 Retention"])

with tab1:
    st.subheader("Monthly Recurring Revenue Over Time")
    fig = px.area(mrr_df, x="month", y="total_mrr", template=CHART_TEMPLATE,
                  labels={"month": "Month", "total_mrr": "MRR ($)"})
    fig.update_traces(line_color=PRIMARY, fillcolor="rgba(99,102,241,0.2)")
    fig.update_layout(height=420, margin=dict(t=20), paper_bgcolor=BG_APP, plot_bgcolor=BG_APP)
    st.plotly_chart(fig, width="stretch")

    st.subheader("Active Subscriptions Over Time")
    fig2 = px.bar(mrr_df, x="month", y="active_subscriptions", template=CHART_TEMPLATE,
                  labels={"month": "Month", "active_subscriptions": "Active Subscriptions"})
    fig2.update_traces(marker_color=SECONDARY)
    fig2.update_layout(height=350, margin=dict(t=20), paper_bgcolor=BG_APP, plot_bgcolor=BG_APP)
    st.plotly_chart(fig2, width="stretch")

with tab2:
    st.subheader("Monthly Churn Rate")
    st.caption("Final month excluded — data boundary artifact (right-censoring)")
    fig3 = px.line(churn_df, x="month", y="churn_rate_pct", markers=True,
                   template=CHART_TEMPLATE,
                   labels={"month": "Month", "churn_rate_pct": "Churn Rate (%)"})
    fig3.update_traces(line_color=DANGER)
    fig3.update_layout(height=420, margin=dict(t=20), paper_bgcolor=BG_APP, plot_bgcolor=BG_APP)
    st.plotly_chart(fig3, width="stretch")

    st.dataframe(churn_df, width="stretch", hide_index=True)

with tab3:
    st.subheader("Cohort Retention (Starter Plan)")
    st.caption("Most recent 3 cohorts excluded — insufficient elapsed time to measure")

    fig4 = go.Figure()
    for col, label, color in [
        ("retained_1mo_pct", "1 Month", SECONDARY),
        ("retained_3mo_pct", "3 Months", PRIMARY),
        ("retained_6mo_pct", "6 Months", SUCCESS),
    ]:
        fig4.add_trace(go.Scatter(
            x=cohort_df["cohort_month"], y=cohort_df[col],
            mode="lines+markers", name=label, line=dict(color=color)
        ))
    fig4.update_layout(template=CHART_TEMPLATE, height=420, margin=dict(t=20),
                       yaxis_title="Retention (%)", xaxis_title="Signup Cohort",
                       legend=dict(orientation="h", yanchor="bottom", y=1.02),
                       paper_bgcolor=BG_APP, plot_bgcolor=BG_APP)
    st.plotly_chart(fig4, width="stretch")

    st.dataframe(cohort_df, width="stretch", hide_index=True)