import React, { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import {
  LayoutDashboard, BarChart3, DollarSign, Users, Repeat, TrendingUp,
  Sparkles, FileText, Settings, HelpCircle, Search, Bell, Moon, Sun,
  PanelLeftClose, PanelLeft, CircleDot, X, MessageSquare, TrendingDown,
  RefreshCw, Wifi, WifiOff, AlertTriangle
} from "lucide-react";

const API_BASE = "http://localhost:8000/api";
const PLANS = ["Starter", "Pro", "Enterprise"];
const PLAN_COLOR = {
  Starter: "var(--warning)",
  Pro: "var(--accent-2)",
  Enterprise: "var(--accent)"
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMonth = (isoDate) => {
  if (!isoDate) return "";
  const [y, m] = isoDate.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} '${y.slice(2)}`;
};

const fmtMoney = (v) => "$" + Math.round(v || 0).toLocaleString();
const fmtCompact = (v) => (v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(v));

const demoTransactions = [
  { id: "INV-88213", customer: "Northwind Traders", plan: "Enterprise", amount: 18400, status: "Paid", date: "Jul 18, 2026" },
  { id: "INV-88212", customer: "Vantage Health", plan: "Pro", amount: 4200, status: "Paid", date: "Jul 18, 2026" },
  { id: "INV-88211", customer: "Fenwick & Cole", plan: "Enterprise", amount: 22100, status: "Pending", date: "Jul 17, 2026" },
  { id: "INV-88210", customer: "Orbital Labs", plan: "Starter", amount: 890, status: "Paid", date: "Jul 17, 2026" },
  { id: "INV-88209", customer: "Redline Logistics", plan: "Pro", amount: 3650, status: "Failed", date: "Jul 16, 2026" },
];

// Extra descriptions for sidebar sections that don't have a dedicated view yet.
const PAGE_INFO = {
  Analytics: "Deeper cuts of the same live metrics — trends, breakdowns, and comparisons.",
  Revenue: "Detailed revenue reporting: by plan, by region, by contract type.",
  Customers: "Customer directory, account health scores, and usage.",
  Subscriptions: "Manage plan changes, upgrades, downgrades, and cancellations.",
  Forecasting: "Revenue and churn forecasting models built on your historical trend.",
  "AI Insights": "Full history of AI-generated insights and recommendations.",
  Reports: "Scheduled and exportable reports.",
};

function useDashboardData(plan) {
  const [core, setCore] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState(null);

  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState(null);

  const qs = plan ? `?plan=${encodeURIComponent(plan)}` : "";

  const fetchCore = useCallback(async () => {
    setCoreLoading(true);
    setCoreError(null);
    try {
      const [mrrRes, churnRes, cohortRes, kpisRes, breakdownRes] = await Promise.all([
        fetch(`${API_BASE}/mrr-trend${qs}`),
        fetch(`${API_BASE}/churn${qs}`),
        fetch(`${API_BASE}/cohort-retention`),
        fetch(`${API_BASE}/kpis${qs}`),
        fetch(`${API_BASE}/plan-breakdown`),
      ]);

      for (const r of [mrrRes, churnRes, cohortRes, kpisRes, breakdownRes]) {
        if (!r.ok) throw new Error(`${r.url.split("/api/")[1]} → HTTP ${r.status}`);
      }

      const [mrrTrend, churnTrend, cohortRetention, kpis, planBreakdown] = await Promise.all([
        mrrRes.json(),
        churnRes.json(),
        cohortRes.json(),
        kpisRes.json(),
        breakdownRes.json(),
      ]);

      setCore({ mrrTrend, churnTrend, cohortRetention, kpis, planBreakdown });
    } catch (e) {
      setCoreError(e.message || "Could not reach the API");
    } finally {
      setCoreLoading(false);
    }
  }, [qs]);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const r = await fetch(`${API_BASE}/insights${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setInsights(await r.json());
    } catch (e) {
      setInsightsError(e.message || "AI insights unavailable");
    } finally {
      setInsightsLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    fetchCore();
  }, [fetchCore]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    core,
    coreLoading,
    coreError,
    refetchCore: fetchCore,
    insights,
    insightsLoading,
    insightsError,
    refetchInsights: fetchInsights,
  };
}

function useCountUp(target, duration = 1100, trigger) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf, start;
    const t = Number.isFinite(target) ? target : 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(t * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger]);
  return value;
}

function KpiCard({ label, icon: Icon, rawValue, format, growth, spark, sparkKey, accent, hero, theme }) {
  const val = useCountUp(rawValue, 1200, theme);
  const hasGrowth = growth !== null && growth !== undefined && !Number.isNaN(growth);
  const positive = growth >= 0;

  return (
    <div className={`kpi-card ${hero ? "kpi-hero" : ""}`}>
      <div className="kpi-top">
        <div className="kpi-icon-wrap" style={{ "--icon-tint": accent }}>
          <Icon size={16} strokeWidth={2.2} />
        </div>
        {hasGrowth && (
          <div className={`kpi-badge ${positive ? "up" : "down"}`}>
            {positive ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{format(val)}</div>
      <div className="kpi-spark">
        <ResponsiveContainer width="100%" height={36}>
          <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={sparkKey}
              stroke={accent}
              strokeWidth={1.75}
              fill={`url(#spark-${sparkKey})`}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="kpi-card skeleton-card">
      <div className="skel skel-icon" />
      <div className="skel skel-line" style={{ width: "60%" }} />
      <div className="skel skel-line" style={{ width: "40%", height: 20 }} />
      <div className="skel skel-line" style={{ width: "100%", height: 30 }} />
    </div>
  );
}

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Analytics", icon: BarChart3 },
  { label: "Revenue", icon: DollarSign },
  { label: "Customers", icon: Users },
  { label: "Subscriptions", icon: Repeat },
  { label: "Forecasting", icon: TrendingUp },
  { label: "AI Insights", icon: Sparkles },
  { label: "Reports", icon: FileText },
];

const NAV_BOTTOM = [
  { label: "Settings", icon: Settings },
  { label: "Help Center", icon: HelpCircle },
];

function Sidebar({ collapsed, setCollapsed, activeNav, setActiveNav, setSettingsOpen, setHelpOpen }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={16} strokeWidth={2.5} /></div>
          {!collapsed && <span className="brand-name">Northstar</span>}
        </div>
        <button className="icon-btn ghost" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="nav-group">
        {NAV.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${activeNav === item.label ? "active" : ""}`}
            title={item.label}
            onClick={() => setActiveNav(item.label)}
          >
            <item.icon size={17} strokeWidth={2} />
            {!collapsed && <span>{item.label}</span>}
            {activeNav === item.label && <span className="nav-dot" />}
          </button>
        ))}
      </nav>

      <div className="nav-group nav-bottom">
        {NAV_BOTTOM.map((item) => (
          <button
            key={item.label}
            className="nav-item"
            title={item.label}
            onClick={() => {
              if (item.label === "Settings") setSettingsOpen((v) => !v);
              if (item.label === "Help Center") setHelpOpen((v) => !v);
            }}
          >
            <item.icon size={17} strokeWidth={2} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div className="sidebar-foot">
          <div className="avatar">SK</div>
          <div className="sidebar-foot-text">
            <div className="sf-name">Shaik Mohammed Umar</div>
            <div className="sf-role">VP Revenue Ops</div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Topbar({ theme, setTheme, connected, plan, setPlan }) {
  return (
    <header className="topbar">
      <div className="search-wrap">
        <Search size={15} className="search-icon" />
        <input placeholder="Search accounts, reports, metrics…" />
        <kbd>⌘K</kbd>
      </div>

      <div className="topbar-right">
        <div className={`conn-pill ${connected ? "live" : "offline"}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? "Live" : "Offline"}
        </div>

        <select className="plan-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">All Plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <button className="icon-btn">
          <Bell size={16} />
          <span className="ping" />
        </button>

        <button className="icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="divider-v" />
        <div className="avatar small">SK</div>
      </div>
    </header>
  );
}

function ChartTip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      {label && <div className="ct-label">{label}</div>}
      {payload.map((p, i) => (
        <div className="ct-row" key={i}>
          <span className="ct-dot" style={{ background: p.color || p.fill || p.stroke }} />
          {p.name}: <b>{prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}</b>
        </div>
      ))}
    </div>
  );
}

// Simple placeholder page for nav items that don't have a full dedicated view yet.
function SectionPage({ label, onBack }) {
  return (
    <div className="panel section-page">
      <div className="panel-head">
        <div>
          <h3>{label}</h3>
          <p className="muted">{PAGE_INFO[label] || "This section is coming soon."}</p>
        </div>
      </div>
      <div className="section-empty">
        <Sparkles size={22} />
        <p>This section is under construction. In the meantime, head back to the Dashboard for live metrics, or ask the AI Copilot in the bottom right.</p>
        <button className="btn primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    </div>
  );
}

export default function EnterpriseDashboard() {
  const [theme, setTheme] = useState("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [plan, setPlan] = useState("");

  // AI copilot chat state
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "Ask me about revenue, churn, or retention and I'll pull from the same live metrics powering this dashboard." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const {
    core,
    coreLoading,
    coreError,
    refetchCore,
    insights,
    insightsLoading,
    insightsError,
    refetchInsights,
  } = useDashboardData(plan || null);

  const connected = !coreLoading && !coreError && !!core;

  let revenueData = [];
  let churnSeries = [];
  let cohortSeries = [];
  let revPerAccount = [];
  let segmentData = [];
  let kpiCards = [];

  if (core) {
    const churnByMonth = Object.fromEntries(core.churnTrend.map((r) => [r.month, r.churn_rate_pct]));
    revenueData = core.mrrTrend.map((r) => ({
      month: formatMonth(r.month),
      mrr: r.total_mrr,
      subs: r.active_subscriptions,
      churn: churnByMonth[r.month] ?? null,
    }));

    churnSeries = core.churnTrend.map((r) => ({
      month: formatMonth(r.month),
      churn_rate_pct: r.churn_rate_pct,
    }));

    cohortSeries = core.cohortRetention.map((r) => ({
      cohort: formatMonth(r.cohort_month),
      retained_1mo_pct: r.retained_1mo_pct,
      retained_3mo_pct: r.retained_3mo_pct,
      retained_6mo_pct: r.retained_6mo_pct,
    }));

    revPerAccount = core.mrrTrend.map((r) => ({
      month: formatMonth(r.month),
      rpa: r.active_subscriptions ? r.total_mrr / r.active_subscriptions : 0,
    }));

    const totalBreakdown = core.planBreakdown.reduce((s, p) => s + p.mrr, 0) || 1;
    segmentData = core.planBreakdown.map((p) => ({
      name: p.plan,
      value: +((p.mrr / totalBreakdown) * 100).toFixed(1),
      color: PLAN_COLOR[p.plan] || "var(--accent)",
    }));

    const mt = core.mrrTrend;
    const last = mt[mt.length - 1];
    const prev = mt[mt.length - 2];
    const subsGrowth = prev ? ((last.active_subscriptions - prev.active_subscriptions) / prev.active_subscriptions) * 100 : null;

    const ct = core.churnTrend;
    const lastChurn = ct[ct.length - 1];
    const prevChurn = ct[ct.length - 2];
    const churnDelta = lastChurn && prevChurn ? lastChurn.churn_rate_pct - prevChurn.churn_rate_pct : null;

    const rpaLast = revPerAccount[revPerAccount.length - 1];
    const rpaPrev = revPerAccount[revPerAccount.length - 2];
    const rpaGrowth = rpaPrev && rpaPrev.rpa ? ((rpaLast.rpa - rpaPrev.rpa) / rpaPrev.rpa) * 100 : null;

    kpiCards = [
      {
        label: "Annual Run Rate",
        icon: DollarSign,
        rawValue: core.kpis.mrr * 12,
        format: fmtMoney,
        growth: core.kpis.mrr_growth_pct,
        spark: revenueData,
        sparkKey: "mrr",
        accent: "var(--accent)",
        hero: true,
      },
      {
        label: "Monthly Recurring Revenue",
        icon: TrendingUp,
        rawValue: core.kpis.mrr,
        format: fmtMoney,
        growth: core.kpis.mrr_growth_pct,
        spark: revenueData,
        sparkKey: "mrr",
        accent: "var(--accent-2)",
      },
      {
        label: "Active Customers",
        icon: Users,
        rawValue: core.kpis.active_subscriptions,
        format: (v) => Math.round(v).toLocaleString(),
        growth: subsGrowth,
        spark: revenueData,
        sparkKey: "subs",
        accent: "#60A5FA",
      },
      {
        label: "Monthly Churn",
        icon: Repeat,
        rawValue: lastChurn ? lastChurn.churn_rate_pct : 0,
        format: (v) => `${v.toFixed(1)}%`,
        growth: churnDelta,
        spark: churnSeries,
        sparkKey: "churn_rate_pct",
        accent: "var(--danger)",
      },
      {
        label: "Avg 6-Month Retention",
        icon: TrendingUp,
        rawValue: core.kpis.avg_6mo_retention_pct || 0,
        format: (v) => `${Math.round(v)}%`,
        growth: null,
        spark: cohortSeries,
        sparkKey: "retained_6mo_pct",
        accent: "var(--success)",
      },
      {
        label: "Revenue per Account",
        icon: DollarSign,
        rawValue: rpaLast ? rpaLast.rpa : 0,
        format: fmtMoney,
        growth: rpaGrowth,
        spark: revPerAccount,
        sparkKey: "rpa",
        accent: "#C084FC",
      },
    ];
  }

  // Builds a short text summary of the live metrics to ground the AI's answers.
  function buildMetricsContext() {
    if (!core) return "Live metrics are still loading, so answer generally and mention the dashboard is still fetching data.";
    const mt = core.mrrTrend;
    const last = mt[mt.length - 1];
    const ct = core.churnTrend;
    const lastChurn = ct[ct.length - 1];
    const weakestCohort = [...core.cohortRetention].sort((a, b) => a.retained_6mo_pct - b.retained_6mo_pct)[0];

    return [
      `MRR: $${Math.round(core.kpis.mrr).toLocaleString()} (${core.kpis.mrr_growth_pct}% growth).`,
      `Active customers: ${core.kpis.active_subscriptions}.`,
      `Latest monthly churn: ${lastChurn ? lastChurn.churn_rate_pct : "n/a"}%.`,
      `Avg 6-month retention: ${core.kpis.avg_6mo_retention_pct}%.`,
      `Plan mix by MRR: ${core.planBreakdown.map((p) => `${p.plan} $${Math.round(p.mrr).toLocaleString()}`).join(", ")}.`,
      weakestCohort ? `Weakest cohort so far: ${formatMonth(weakestCohort.cohort_month)} at ${weakestCohort.retained_6mo_pct}% 6-month retention.` : "",
      last ? `Most recent month (${formatMonth(last.month)}) MRR: $${Math.round(last.total_mrr).toLocaleString()}.` : "",
    ].filter(Boolean).join(" ");
  }

  async function sendChatMessage(presetText) {
    const question = (presetText ?? chatInput).trim();
    if (!question || chatLoading) return;

    setChatMessages((m) => [...m, { role: "user", content: question }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `You are the AI Copilot inside a SaaS revenue dashboard called Northstar. Answer the user's question in 2-4 concise sentences, referencing the numbers below where relevant. Do not invent numbers that aren't given.\n\nLive metrics: ${buildMetricsContext()}\n\nQuestion: ${question}`,
            },
          ],
        }),
      });
      const data = await response.json();
      const answer = (data.content || [])
        .map((block) => block.text || "")
        .join("\n")
        .trim() || "I couldn't generate a response just now — try again in a moment.";
      setChatMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setChatMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the AI service. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="dash-root" data-theme={theme}>
      <style>{CSS}</style>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        setSettingsOpen={setSettingsOpen}
        setHelpOpen={setHelpOpen}
      />

      <div className="main-col">
        <Topbar
          theme={theme}
          setTheme={setTheme}
          connected={connected}
          plan={plan}
          setPlan={setPlan}
        />

        <main className="content">
          <div className="page-head">
            <div>
              <h1>{activeNav === "Dashboard" ? "Executive Overview" : activeNav}</h1>
              <p>
                {activeNav === "Dashboard"
                  ? `Live data from your PostgreSQL database${plan ? ` — ${plan} plan` : ""}.`
                  : PAGE_INFO[activeNav] || ""}
              </p>
            </div>

            <div className="page-head-actions">
              <button
                className="btn ghost"
                onClick={() => {
                  refetchCore();
                  refetchInsights();
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>

              <button className="btn primary" onClick={() => setCopilotOpen(true)}>
                <Sparkles size={14} /> Ask AI
              </button>
            </div>
          </div>

          {activeNav !== "Dashboard" ? (
            <SectionPage label={activeNav} onBack={() => setActiveNav("Dashboard")} />
          ) : (
            <>
              {coreError && (
                <div className="error-banner">
                  <AlertTriangle size={16} />
                  <div>
                    <div className="eb-title">Can't reach the API at {API_BASE}</div>
                    <div className="eb-body">
                      {coreError} — make sure <code>uvicorn main:app --reload --port 8000</code> is running.
                    </div>
                  </div>
                  <button className="btn ghost small" onClick={refetchCore}>
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              )}

              <div className="kpi-grid">
                {coreLoading
                  ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
                  : kpiCards.map((k) => <KpiCard key={k.label} {...k} theme={theme} />)}
              </div>

              <div className="grid-2">
                <div className="panel span-2">
                  <div className="panel-head">
                    <div>
                      <h3>Revenue Trend</h3>
                      <p className="muted">Monthly recurring revenue{plan ? ` — ${plan}` : ""}</p>
                    </div>
                    <div className="legend">
                      <span><i style={{ background: "var(--accent)" }} />MRR</span>
                    </div>
                  </div>

                  {coreLoading ? (
                    <div className="chart-skel" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={revenueData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "var(--text-faint)", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                        <YAxis tick={{ fill: "var(--text-faint)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={40} />
                        <Tooltip content={<ChartTip prefix="$" />} />
                        <Area type="monotone" dataKey="mrr" stroke="var(--accent)" strokeWidth={2.5} fill="url(#mrrFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Customer Segments</h3>
                      <p className="muted">Share of MRR by plan</p>
                    </div>
                  </div>

                  {coreLoading ? (
                    <div className="chart-skel" style={{ height: 170 }} />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={segmentData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {segmentData.map((s, i) => <Cell key={i} fill={s.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTip suffix="%" />} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="segment-legend">
                        {segmentData.map((s) => (
                          <div className="seg-row" key={s.name}>
                            <span className="seg-dot" style={{ background: s.color }} />
                            <span className="seg-name">{s.name}</span>
                            <span className="seg-val">{s.value}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid-3">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Churn Rate</h3>
                      <p className="muted">Monthly, trailing series</p>
                    </div>
                  </div>

                  {coreLoading ? (
                    <div className="chart-skel" style={{ height: 210 }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={210}>
                      <LineChart data={churnSeries} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "var(--text-faint)", fontSize: 10.5 }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10.5 }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTip suffix="%" />} />
                        <Line type="monotone" dataKey="churn_rate_pct" name="Churn" stroke="var(--danger)" strokeWidth={2.25} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Cohort Retention</h3>
                      <p className="muted">Starter plan, by signup month</p>
                    </div>
                  </div>

                  {coreLoading ? (
                    <div className="chart-skel" style={{ height: 210 }} />
                  ) : (
                    <ResponsiveContainer width="100%" height={210}>
                      <LineChart data={cohortSeries} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="cohort" tick={{ fill: "var(--text-faint)", fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10.5 }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                        <Tooltip content={<ChartTip suffix="%" />} />
                        <Line type="monotone" dataKey="retained_1mo_pct" name="1mo" stroke="var(--accent-2)" strokeWidth={1.75} dot={false} />
                        <Line type="monotone" dataKey="retained_3mo_pct" name="3mo" stroke="var(--accent)" strokeWidth={1.75} dot={false} />
                        <Line type="monotone" dataKey="retained_6mo_pct" name="6mo" stroke="var(--success)" strokeWidth={2.25} dot={false} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3 className="ai-title"><Sparkles size={14} /> AI Insights</h3>
                      <p className="muted">Generated by Groq from live metrics</p>
                    </div>
                  </div>

                  {insightsLoading ? (
                    <div className="insight-list">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="chart-skel" style={{ height: 76, marginBottom: 8 }} />
                      ))}
                    </div>
                  ) : insightsError ? (
                    <div className="insight-error">
                      <AlertTriangle size={14} /> {insightsError}
                      <button className="btn ghost small" onClick={refetchInsights}>
                        <RefreshCw size={11} /> Retry
                      </button>
                    </div>
                  ) : (
                    <div className="insight-list">
                      {(insights || []).map((ins) => (
                        <div className="insight-card" key={ins.title}>
                          <span className={`tag ${ins.tagColor || "accent"}`}>{ins.tag}</span>
                          <div className="insight-title">{ins.title}</div>
                          <div className="insight-body">{ins.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Recent Transactions</h3>
                    <p className="muted">Demo data — connect an invoices endpoint to make this live</p>
                  </div>
                  <button className="btn ghost small">View all</button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoTransactions.map((t) => (
                        <tr key={t.id}>
                          <td className="mono">{t.id}</td>
                          <td>{t.customer}</td>
                          <td><span className="plan-chip">{t.plan}</span></td>
                          <td className="mono">{fmtMoney(t.amount)}</td>
                          <td><span className={`status ${t.status.toLowerCase()}`}><CircleDot size={9} />{t.status}</span></td>
                          <td className="muted">{t.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <button className="copilot-fab" onClick={() => setCopilotOpen((v) => !v)}>
        <Sparkles size={18} />
      </button>

      {copilotOpen && (
        <div className="copilot-panel">
          <div className="copilot-head">
            <div className="copilot-title"><Sparkles size={15} /> AI Copilot</div>
            <button className="icon-btn ghost" onClick={() => setCopilotOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="copilot-body">
            {chatMessages.map((m, i) => (
              <div className={`copilot-msg ${m.role === "user" ? "user" : "ai"}`} key={i}>
                <p>{m.content}</p>
              </div>
            ))}

            {chatLoading && (
              <div className="copilot-msg ai">
                <p className="typing">Thinking…</p>
              </div>
            )}

            <div className="copilot-suggestions">
              <button onClick={() => sendChatMessage("Explain the churn trend")}>
                <MessageSquare size={12} /> Explain the churn trend
              </button>
              <button onClick={() => sendChatMessage("Which cohort is weakest?")}>
                <TrendingDown size={12} /> Which cohort is weakest?
              </button>
              <button onClick={() => sendChatMessage("Draft an exec summary")}>
                <FileText size={12} /> Draft an exec summary
              </button>
            </div>
          </div>

          <div className="copilot-input">
            <input
              placeholder="Ask about your business…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChatMessage();
              }}
              disabled={chatLoading}
            />
            <button className="btn primary small" onClick={() => sendChatMessage()} disabled={chatLoading}>
              <Sparkles size={13} />
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-card">
          <div className="panel-head">
            <div>
              <h3>Settings</h3>
              <p className="muted">Dashboard preferences</p>
            </div>
            <button className="icon-btn ghost" onClick={() => setSettingsOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="insight-list">
            <div className="insight-card">
              <div className="insight-title">Theme</div>
              <div className="insight-body">Current theme: {theme}. Use the sun/moon icon in the top bar to switch.</div>
            </div>
            <div className="insight-card">
              <div className="insight-title">Refresh</div>
              <div className="insight-body">Use Refresh on the Dashboard to reload live metrics.</div>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="settings-card help-card">
          <div className="panel-head">
            <div>
              <h3>Help Center</h3>
              <p className="muted">Quick answers</p>
            </div>
            <button className="icon-btn ghost" onClick={() => setHelpOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="insight-list">
            <div className="insight-card">
              <div className="insight-title">Live data not showing?</div>
              <div className="insight-body">Make sure your FastAPI backend is running with <code>uvicorn main:app --reload --port 8000</code>.</div>
            </div>
            <div className="insight-card">
              <div className="insight-title">Ask AI</div>
              <div className="insight-body">Click the sparkle button (bottom right) to ask questions about your live metrics.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

html, body, #root {
  margin: 0;
  padding: 0;
  min-height: 100dvh;
  height: 100dvh;
  width: 100%;
}

.dash-root{
  --font-display:'Space Grotesk',sans-serif;
  --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  position:relative;
  display:flex;
  width:100vw;
  min-height:100dvh;
  height:100dvh;
  overflow:auto;
  font-family:var(--font-body);
  color:var(--text);
  isolation:isolate;
}
.dash-root[data-theme="dark"]{
  --bg:#0A0B10;
  --bg-2:#0D0F16;
  --surface:rgba(23,26,36,0.72);
  --surface-solid:#12141C;
  --surface-2:#171A24;
  --border:rgba(255,255,255,0.08);
  --border-strong:rgba(255,255,255,0.14);
  --text:#F1F2F6;
  --text-dim:#9CA0B4;
  --text-faint:#5C6079;
  --accent:#7C6CF6;
  --accent-2:#4FD1C5;
  --success:#34D399;
  --warning:#FBBF24;
  --danger:#FB7185;
  --shadow-lg:0 24px 70px -24px rgba(0,0,0,0.65);
  --shadow-sm:0 8px 24px -12px rgba(0,0,0,0.5);
  background: radial-gradient(1100px 500px at 85% -10%, rgba(124,108,246,0.16), transparent 60%),
    radial-gradient(900px 500px at 0% 100%, rgba(79,209,197,0.08), transparent 60%), var(--bg);
}

.dash-root[data-theme="light"]{
  --bg:#F3F4F8;
  --bg-2:#EEF0F6;
  --surface:rgba(255,255,255,0.82);
  --surface-solid:#FFFFFF;
  --surface-2:#FAFBFD;
  --border:rgba(15,23,42,0.08);
  --border-strong:rgba(15,23,42,0.14);
  --text:#12141C;
  --text-dim:#5B6072;
  --text-faint:#9297AA;
  --accent:#6D5EF0;
  --accent-2:#0D9C8E;
  --success:#0F9D63;
  --warning:#C2760B;
  --danger:#DC3D5D;
  --shadow-lg:0 24px 60px -24px rgba(30,41,80,0.18);
  --shadow-sm:0 6px 18px -10px rgba(30,41,80,0.12);
  background: radial-gradient(1100px 500px at 85% -10%, rgba(109,94,240,0.08), transparent 60%),
    radial-gradient(900px 500px at 0% 100%, rgba(13,156,142,0.06), transparent 60%), var(--bg);
}

.dash-root *{ box-sizing:border-box; }
.dash-root button{ font-family:inherit; cursor:pointer; }
.dash-root input, .dash-root select{ font-family:inherit; }
.dash-root .mono{ font-family:var(--font-mono); font-size:12.5px; }
.dash-root .muted{ color:var(--text-faint); font-size:12.5px; margin:2px 0 0; }

.sidebar{
  width:230px;
  flex-shrink:0;
  display:flex;
  flex-direction:column;
  padding:16px 12px;
  border-right:1px solid var(--border);
  background:var(--bg-2);
  transition:width .25s ease;
}
.sidebar.collapsed{ width:68px; }
.sidebar-head{ display:flex; align-items:center; justify-content:space-between; padding:4px 4px 18px; }
.brand{ display:flex; align-items:center; gap:9px; overflow:hidden; }
.brand-mark{ width:28px; height:28px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, var(--accent), var(--accent-2)); color:#fff; box-shadow:var(--shadow-sm); }
.brand-name{ font-family:var(--font-display); font-weight:700; font-size:15px; white-space:nowrap; }
.nav-group{ display:flex; flex-direction:column; gap:2px; margin-top:6px; }
.nav-bottom{ margin-top:auto; padding-top:10px; border-top:1px solid var(--border); }
.nav-item{ display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:9px; border:none; background:transparent; color:var(--text-dim); font-size:13.5px; font-weight:500; text-align:left; position:relative; transition:background .15s, color .15s; white-space:nowrap; overflow:hidden; }
.nav-item:hover{ background:var(--surface-2); color:var(--text); }
.nav-item.active{ background:var(--surface-2); color:var(--text); box-shadow:inset 0 0 0 1px var(--border-strong); }
.nav-dot{ margin-left:auto; width:5px; height:5px; border-radius:50%; background:var(--accent); flex-shrink:0; }
.sidebar-foot{ display:flex; align-items:center; gap:9px; padding:10px 6px 2px; margin-top:10px; }
.avatar{ width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg, var(--accent), #C084FC); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11.5px; font-weight:700; flex-shrink:0; }
.avatar.small{ width:26px; height:26px; border-radius:8px; font-size:10.5px; }
.sf-name{ font-size:12.5px; font-weight:600; }
.sf-role{ font-size:11px; color:var(--text-faint); }

.main-col{ flex:1; display:flex; flex-direction:column; min-width:0; }
.topbar{ height:60px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 22px; border-bottom:1px solid var(--border); gap:16px; background:var(--surface); backdrop-filter:blur(16px); }
.search-wrap{ position:relative; display:flex; align-items:center; max-width:360px; width:100%; }
.search-icon{ position:absolute; left:12px; color:var(--text-faint); }
.search-wrap input{ width:100%; padding:8px 40px 8px 34px; border-radius:9px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:13px; outline:none; }
.search-wrap kbd{ position:absolute; right:10px; font-size:10.5px; color:var(--text-faint); border:1px solid var(--border); border-radius:5px; padding:1.5px 5px; }
.topbar-right{ display:flex; align-items:center; gap:8px; }
.conn-pill{ display:flex; align-items:center; gap:5px; font-size:11px; font-weight:700; padding:5px 9px; border-radius:7px; }
.conn-pill.live{ color:var(--success); background:color-mix(in srgb, var(--success) 14%, transparent); }
.conn-pill.offline{ color:var(--danger); background:color-mix(in srgb, var(--danger) 14%, transparent); }
.plan-select{ font-size:12.5px; color:var(--text-dim); background:var(--surface-2); border:1px solid var(--border); padding:7px 9px; border-radius:8px; outline:none; }
.icon-btn{ position:relative; width:32px; height:32px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-dim); display:flex; align-items:center; justify-content:center; }
.icon-btn:hover{ color:var(--text); border-color:var(--border-strong); }
.icon-btn.ghost{ background:transparent; border-color:transparent; }
.ping{ position:absolute; top:6px; right:7px; width:6px; height:6px; border-radius:50%; background:var(--danger); }
.divider-v{ width:1px; height:20px; background:var(--border); margin:0 2px; }

.content{ flex:1; overflow-y:auto; padding:22px 26px 40px; display:flex; flex-direction:column; gap:20px; }
.page-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.page-head h1{ font-family:var(--font-display); font-size:24px; font-weight:700; margin:0 0 4px; letter-spacing:-.01em; }
.page-head p{ margin:0; color:var(--text-faint); font-size:13px; }
.page-head-actions{ display:flex; gap:8px; }
.btn{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 13px; border-radius:9px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-dim); }
.btn.primary{ background:linear-gradient(135deg, var(--accent), #9B8CFB); color:#fff; border:none; }
.btn.small{ padding:6px 10px; font-size:11.5px; }

.error-banner{ display:flex; align-items:center; gap:12px; background:color-mix(in srgb, var(--danger) 10%, var(--surface)); border:1px solid color-mix(in srgb, var(--danger) 35%, var(--border)); color:var(--danger); border-radius:12px; padding:12px 14px; font-size:12.5px; }
.eb-title{ font-weight:700; color:var(--text); }
.eb-body{ color:var(--text-dim); margin-top:1px; }
.error-banner .btn{ margin-left:auto; flex-shrink:0; }

.kpi-grid{ display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:14px; }
.kpi-card{ background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:15px 16px 10px; backdrop-filter:blur(18px); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:6px; }
.kpi-hero{ background:linear-gradient(160deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), var(--surface)); }
.kpi-top{ display:flex; align-items:center; justify-content:space-between; }
.kpi-icon-wrap{ width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--icon-tint) 16%, transparent); color:var(--icon-tint); }
.kpi-badge{ display:flex; align-items:center; gap:2px; font-size:11px; font-weight:700; padding:2px 6px; border-radius:6px; }
.kpi-badge.up{ color:var(--success); background:color-mix(in srgb, var(--success) 14%, transparent); }
.kpi-badge.down{ color:var(--danger); background:color-mix(in srgb, var(--danger) 14%, transparent); }
.kpi-label{ font-size:12px; color:var(--text-faint); font-weight:500; }
.kpi-value{ font-family:var(--font-display); font-size:21px; font-weight:700; letter-spacing:-.01em; }
.kpi-spark{ margin:0 -4px -4px; }

.skeleton-card{ gap:10px; }
.skel{ background:var(--surface-2); border-radius:6px; position:relative; overflow:hidden; }
.skel::after{ content:""; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--text) 8%, transparent), transparent); animation:shimmer 1.4s infinite; }
.skel-icon{ width:26px; height:26px; border-radius:7px; }
.skel-line{ height:12px; }
.chart-skel{ height:260px; border-radius:10px; background:var(--surface-2); position:relative; overflow:hidden; }
.chart-skel::after{ content:""; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--text) 8%, transparent), transparent); animation:shimmer 1.4s infinite; }

@keyframes shimmer{ 100%{ transform:translateX(100%); } }

.grid-2{ display:grid; grid-template-columns:2fr 1fr; gap:16px; }
.grid-3{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }
.panel{ background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px 18px 16px; backdrop-filter:blur(18px); box-shadow:var(--shadow-sm); }
.panel-head{ display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px; gap:10px; }
.panel-head h3{ margin:0; font-family:var(--font-display); font-size:14.5px; font-weight:700; display:flex; align-items:center; gap:6px; }
.ai-title{ color:var(--accent); }
.legend{ display:flex; gap:12px; font-size:11.5px; color:var(--text-dim); align-items:center; }
.legend i{ display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; }

.segment-legend{ margin-top:10px; display:flex; flex-direction:column; gap:8px; }
.seg-row{ display:flex; align-items:center; gap:8px; font-size:12.5px; }
.seg-dot{ width:8px; height:8px; border-radius:50%; }
.seg-name{ color:var(--text-dim); flex:1; }
.seg-val{ font-weight:700; font-family:var(--font-mono); font-size:12px; }

.insight-list{ display:flex; flex-direction:column; gap:10px; }
.insight-card{ background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:11px 12px; }
.tag{ display:inline-block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; padding:2px 7px; border-radius:5px; margin-bottom:6px; }
.tag.success{ color:var(--success); background:color-mix(in srgb, var(--success) 16%, transparent); }
.tag.warning{ color:var(--warning); background:color-mix(in srgb, var(--warning) 16%, transparent); }
.tag.accent{ color:var(--accent); background:color-mix(in srgb, var(--accent) 16%, transparent); }
.insight-title{ font-size:12.5px; font-weight:700; margin-bottom:3px; }
.insight-body{ font-size:11.5px; color:var(--text-faint); line-height:1.5; }
.insight-error{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; color:var(--danger); }

.table-wrap{ overflow-x:auto; }
table{ width:100%; border-collapse:collapse; font-size:12.5px; }
thead th{ text-align:left; color:var(--text-faint); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.03em; padding:0 10px 10px; border-bottom:1px solid var(--border); }
tbody td{ padding:11px 10px; border-bottom:1px solid var(--border); }
tbody tr:last-child td{ border-bottom:none; }
tbody tr:hover{ background:var(--surface-2); }

.plan-chip{ font-size:11px; font-weight:600; padding:3px 8px; border-radius:6px; background:var(--surface-2); border:1px solid var(--border); }
.status{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; }
.status.paid{ color:var(--success); }
.status.pending{ color:var(--warning); }
.status.failed{ color:var(--danger); }

.chart-tip{ background:var(--surface-solid); border:1px solid var(--border-strong); border-radius:9px; padding:9px 11px; box-shadow:var(--shadow-lg); font-size:12px; }
.ct-label{ color:var(--text-faint); font-size:11px; margin-bottom:4px; }
.ct-row{ display:flex; align-items:center; gap:6px; color:var(--text-dim); }
.ct-dot{ width:7px; height:7px; border-radius:50%; }

.section-page{ min-height:320px; }
.section-empty{ display:flex; flex-direction:column; align-items:flex-start; gap:12px; padding:24px 4px 8px; color:var(--text-dim); max-width:440px; }
.section-empty svg{ color:var(--accent); }
.section-empty p{ margin:0; font-size:13px; line-height:1.6; }

.copilot-fab{ position:absolute; bottom:24px; right:24px; width:50px; height:50px; border-radius:50%; border:none; background:linear-gradient(135deg, var(--accent), var(--accent-2)); color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow-lg); z-index:5; }
.copilot-panel{ position:absolute; bottom:24px; right:24px; width:320px; max-height:420px; display:flex; flex-direction:column; background:var(--surface-solid); border:1px solid var(--border-strong); border-radius:16px; box-shadow:var(--shadow-lg); z-index:6; overflow:hidden; }
.copilot-head{ display:flex; align-items:center; justify-content:space-between; padding:13px 14px; border-bottom:1px solid var(--border); }
.copilot-title{ display:flex; align-items:center; gap:6px; font-weight:700; font-size:13px; color:var(--accent); }
.copilot-body{ padding:14px; overflow-y:auto; flex:1; }
.copilot-msg{ margin-bottom:8px; }
.copilot-msg.ai p{ background:var(--surface-2); border-radius:10px; padding:11px 12px; font-size:12.5px; line-height:1.55; color:var(--text-dim); margin:0; }
.copilot-msg.user p{ background:color-mix(in srgb, var(--accent) 16%, var(--surface-2)); border-radius:10px; padding:11px 12px; font-size:12.5px; line-height:1.55; color:var(--text); margin:0 0 0 24px; }
.copilot-msg .typing{ opacity:.65; font-style:italic; }
.copilot-suggestions{ display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.copilot-suggestions button{ display:flex; align-items:center; gap:7px; text-align:left; font-size:11.5px; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-dim); }
.copilot-suggestions button:hover{ color:var(--text); border-color:var(--border-strong); }
.copilot-input{ display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); }
.copilot-input input{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:12.5px; outline:none; }

.settings-card{
  position:absolute;
  top:72px;
  left:18px;
  width:280px;
  z-index:10;
  background:var(--surface-solid);
  border:1px solid var(--border-strong);
  border-radius:14px;
  padding:12px;
  box-shadow:var(--shadow-lg);
}
.help-card{ top:auto; bottom:24px; left:18px; }

@media (max-width: 1100px){
  .kpi-grid{ grid-template-columns:repeat(3,1fr); }
  .grid-2{ grid-template-columns:1fr; }
  .grid-3{ grid-template-columns:1fr; }
}
`;