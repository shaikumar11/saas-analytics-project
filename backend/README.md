# SaaS Analytics API

FastAPI layer on top of your existing `metrics.py` and `generate_insights.py`.
Neither of those files was changed — this just exposes them over HTTP.

## Run it

```bash
cd backend
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env   # then fill in DB_PASSWORD and GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

Interactive docs (and a quick way to sanity-check queries): http://localhost:8000/docs

## Endpoints

| Endpoint | Mirrors | Notes |
|---|---|---|
| `GET /api/mrr-trend?plan=Pro` | `get_mrr_trend()` | omit `plan` for all plans |
| `GET /api/churn?plan=Pro` | `get_monthly_churn()` | last month already excluded, per your logic |
| `GET /api/cohort-retention` | `get_cohort_retention()` | last 3 cohorts already excluded |
| `GET /api/kpis?plan=Pro` | derived | MRR, growth %, active subs, avg churn, avg 6mo retention in one call |
| `GET /api/plan-breakdown` | derived | latest MRR per plan, for the donut chart |
| `GET /api/insights?plan=Pro` | `generate_executive_summary()` | calls Groq; cached 5 min per plan |

`plan` accepts `Starter`, `Pro`, or `Enterprise`. Anything else returns a 400.

## Caching

A plain in-memory dict with a 5-minute TTL stands in for Redis for now —
same purpose (don't hit Postgres or Groq on every page load), one less
service to run locally. It's per-process and resets on restart/reload,
which is fine for dev. When you're ready for Redis, only `_cache_get` /
`_cache_set` in `main.py` need to change; nothing else depends on how the
cache is implemented.

## Wiring up the React dashboard

Replace the mock arrays in the dashboard with fetches to these endpoints,
e.g.:

```js
const [kpis, setKpis] = useState(null);
const [mrrTrend, setMrrTrend] = useState([]);

useEffect(() => {
  fetch(`http://localhost:8000/api/kpis${plan ? `?plan=${plan}` : ""}`)
    .then(r => r.json()).then(setKpis);
  fetch(`http://localhost:8000/api/mrr-trend${plan ? `?plan=${plan}` : ""}`)
    .then(r => r.json()).then(setMrrTrend);
}, [plan]);
```

The `/api/insights` response is already shaped to match the dashboard's
`{ tag, tagColor, title, body }` insight cards directly — no mapping needed
on the frontend side.

## Before this goes anywhere beyond localhost

- Lock down `allow_origins` in `main.py` to your actual frontend URL(s) —
  it's wide open (`*`) right now for local dev convenience.
- Move the Groq API key handling server-side only (it already is here —
  just don't skip this when you containerize).
- Swap the in-memory cache for Redis once more than one process/worker is
  running, otherwise each worker caches independently.
