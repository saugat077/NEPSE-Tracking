# NEPSE Portfolio Tracker

Personal, single-user, local-only web app for tracking a NEPSE (Nepal Stock Exchange) stock
portfolio — replaces the Excel workbook described in `NepsePortfolioTracker.md`.

- **Frontend:** React + Vite + Tailwind CSS v4 + shadcn/ui + Recharts
- **Backend:** Python + Flask
- **DB:** SQLite at `backend/portfolio.db`
- Dates are **Nepali (BS) calendar** stored as text, e.g. `2083-01-31`. Prices are entered manually.

## First-time setup

Backend (from `backend/`) — Flask is a **Python** package

```powershell
# PowerShell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

```bash
# Git Bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```

Frontend (from `frontend/`):

```powershell
npm install
```

## Running — everyday use (one click, no cloud)

Double-click **`Start NEPSE Tracker.bat`** in the project root. It serves the whole app
(frontend + API) locally via Waitress and opens `http://localhost:18345` in your browser
(uncommon port on purpose, so other local projects won't clash with it).
The server runs in a minimized console window — close it to stop.

After changing frontend code, rebuild once (`npm run build` in `frontend/`) so the
launcher serves the new version.

## Running — development (two terminals)

```powershell
# Terminal 1 — backend on http://localhost:18345
cd backend
.venv\Scripts\activate
flask run -p 18345

# Terminal 2 — frontend (Vite prints the local URL, usually http://localhost:5173)
cd frontend
npm run dev
```

Open the Vite URL in your browser. Start on the **Stocks** page (transactions and dividends
reference the stock master).

## Tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_fees.py
```

## Pages

| Page | What it does |
|---|---|
| Dashboard | Summary stats, allocation pie, invested-vs-value and P&L charts |
| Transactions | BUY/SELL/BONUS/RIGHT/IPO with live fee preview; fees stored on save |
| Holdings | Derived weighted-average-cost holdings (read-only, never stored) |
| Stocks & Prices | Stock master; click a price to update it inline |
| Dividends | Cash dividends — gross = rate × Rs 100 par × shares, 5% TDS |
| Bank Screener | Quarterly fundamentals grid (EPS, P/E, NPL, ROE, CAR, dividends, verdict) |
| Rank History | Composite scores per bank per quarter; rank computed by sorting scores |

## Domain rules

See `CLAUDE.md` and `Plan.md` — fee slabs, holdings math and dividend TDS are verified against
the original Excel data; don't change them casually.
