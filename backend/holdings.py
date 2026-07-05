"""Holdings / dashboard aggregation — always derived from transactions, never stored.

Weighted-average-cost method:
- shares  = sum qty of BUY/IPO/RIGHT/BONUS minus sum qty of SELL
- invested = sum of net_amount of acquiring txns; on SELL, invested is
  reduced by avg_cost * qty_sold (avg cost includes fees)
- realized P&L on SELL = net proceeds - avg_cost * qty_sold
"""

ACQUIRE_TYPES = ("BUY", "IPO", "RIGHT", "BONUS")

EPS = 1e-9


def compute_holdings(conn):
    """Return (rows, totals). Each row is a per-symbol derived holding."""
    txns = conn.execute(
        """SELECT t.*, s.symbol, s.company, s.sector, s.current_price, s.prev_price
           FROM transactions t JOIN stocks s ON s.id = t.stock_id
           ORDER BY t.date, t.id"""
    ).fetchall()

    div_rows = conn.execute(
        "SELECT stock_id, SUM(net) AS net FROM dividends GROUP BY stock_id"
    ).fetchall()
    dividends_by_stock = {r["stock_id"]: r["net"] or 0.0 for r in div_rows}

    state = {}  # stock_id -> per-symbol running state
    for t in txns:
        st = state.setdefault(
            t["stock_id"],
            {
                "symbol": t["symbol"],
                "company": t["company"],
                "sector": t["sector"],
                "current_price": t["current_price"],
                "prev_price": t["prev_price"],
                "shares": 0.0,
                "invested": 0.0,
                "realized_pl": 0.0,
                "fees_paid": 0.0,
            },
        )
        st["fees_paid"] += t["commission"] + t["sebon_fee"] + t["dp_fee"]
        if t["type"] in ACQUIRE_TYPES:
            st["shares"] += t["quantity"]
            st["invested"] += t["net_amount"]
        elif t["type"] == "SELL":
            avg_cost = st["invested"] / st["shares"] if st["shares"] > EPS else 0.0
            cost_removed = avg_cost * t["quantity"]
            st["realized_pl"] += t["net_amount"] - cost_removed
            st["invested"] -= cost_removed
            st["shares"] -= t["quantity"]
            if st["shares"] <= EPS:
                st["shares"] = 0.0
                st["invested"] = 0.0

    rows = []
    for stock_id, st in state.items():
        shares = st["shares"]
        invested = round(st["invested"], 2)
        avg_cost = round(invested / shares, 2) if shares > EPS else 0.0
        current_value = round(shares * st["current_price"], 2)
        unrealized_pl = round(current_value - invested, 2)
        return_pct = round(unrealized_pl / invested * 100, 2) if invested > EPS else 0.0
        # day change vs the price before the latest manual update
        has_prev = st["prev_price"] > EPS and shares > EPS
        day_change = round((st["current_price"] - st["prev_price"]) * shares, 2) if has_prev else None
        day_change_pct = (
            round((st["current_price"] - st["prev_price"]) / st["prev_price"] * 100, 2)
            if has_prev
            else None
        )
        rows.append(
            {
                "stock_id": stock_id,
                "symbol": st["symbol"],
                "company": st["company"],
                "sector": st["sector"],
                "shares": shares,
                "invested": invested,
                "avg_cost": avg_cost,
                "current_price": st["current_price"],
                "prev_price": st["prev_price"],
                "day_change": day_change,
                "day_change_pct": day_change_pct,
                "current_value": current_value,
                "unrealized_pl": unrealized_pl,
                "return_pct": return_pct,
                "realized_pl": round(st["realized_pl"], 2),
                "fees_paid": round(st["fees_paid"], 2),
                "dividends_net": round(dividends_by_stock.get(stock_id, 0.0), 2),
                "active": shares > EPS,
            }
        )

    total_value = sum(r["current_value"] for r in rows)
    for r in rows:
        r["weight_pct"] = (
            round(r["current_value"] / total_value * 100, 2) if total_value > EPS else 0.0
        )

    rows.sort(key=lambda r: (-r["active"], -r["current_value"], r["symbol"]))

    total_invested = round(sum(r["invested"] for r in rows), 2)
    totals = {
        "invested": total_invested,
        "current_value": round(total_value, 2),
        "unrealized_pl": round(sum(r["unrealized_pl"] for r in rows), 2),
        "realized_pl": round(sum(r["realized_pl"] for r in rows), 2),
        "fees_paid": round(sum(r["fees_paid"] for r in rows), 2),
        # sum ALL dividends, not per-row values — a dividend on a stock with
        # no transactions has no row but must still count toward the total
        "dividends_net": round(sum(dividends_by_stock.values()), 2),
        "return_pct": (
            round(sum(r["unrealized_pl"] for r in rows) / total_invested * 100, 2)
            if total_invested > EPS
            else 0.0
        ),
    }
    return rows, totals


def current_shares(conn, stock_id, as_of_date=None):
    """Shares held for one stock (for SELL validation).

    With as_of_date, only transactions on or before that BS date count —
    a SELL must be funded by shares held on its own date, not by later
    BUYs. BS dates are zero-padded text, so lexicographic compare is
    chronological."""
    sql = """SELECT
               COALESCE(SUM(CASE WHEN type IN ('BUY','IPO','RIGHT','BONUS') THEN quantity
                                 WHEN type = 'SELL' THEN -quantity END), 0) AS shares
             FROM transactions WHERE stock_id = ?"""
    params = [stock_id]
    if as_of_date is not None:
        sql += " AND date <= ?"
        params.append(as_of_date)
    row = conn.execute(sql, params).fetchone()
    return row["shares"] or 0.0


def value_history(conn):
    """Portfolio value + invested over time, replaying transactions against
    manual price snapshots. One point per BS date that has any price data;
    stocks without a price yet are valued at cost."""
    txns = conn.execute(
        "SELECT stock_id, date, type, quantity, net_amount FROM transactions ORDER BY date, id"
    ).fetchall()
    points = conn.execute(
        "SELECT stock_id, date, price FROM price_history ORDER BY date"
    ).fetchall()
    if not txns:
        return []

    dates = sorted({p["date"] for p in points} | {t["date"] for t in txns})
    prices_by_stock = {}
    for p in points:
        prices_by_stock.setdefault(p["stock_id"], []).append((p["date"], p["price"]))

    state = {}  # stock_id -> {shares, invested}
    ti = 0
    series = []
    for d in dates:
        while ti < len(txns) and txns[ti]["date"] <= d:
            t = txns[ti]
            st = state.setdefault(t["stock_id"], {"shares": 0.0, "invested": 0.0})
            if t["type"] in ACQUIRE_TYPES:
                st["shares"] += t["quantity"]
                st["invested"] += t["net_amount"]
            elif t["type"] == "SELL":
                avg = st["invested"] / st["shares"] if st["shares"] > EPS else 0.0
                st["invested"] -= avg * t["quantity"]
                st["shares"] -= t["quantity"]
                if st["shares"] <= EPS:
                    st["shares"], st["invested"] = 0.0, 0.0
            ti += 1

        value = 0.0
        invested = 0.0
        for stock_id, st in state.items():
            if st["shares"] <= EPS:
                continue
            invested += st["invested"]
            last = None
            for pd, price in prices_by_stock.get(stock_id, []):
                if pd <= d:
                    last = price
                else:
                    break
            value += st["shares"] * last if last is not None else st["invested"]
        series.append({"date": d, "value": round(value, 2), "invested": round(invested, 2)})
    return series


def compute_dashboard(conn):
    """Summary metrics + allocation data for the dashboard."""
    rows, totals = compute_holdings(conn)
    active = [r for r in rows if r["active"]]

    txn_count = conn.execute("SELECT COUNT(*) AS c FROM transactions").fetchone()["c"]
    stock_count = conn.execute("SELECT COUNT(*) AS c FROM stocks").fetchone()["c"]
    div_count = conn.execute("SELECT COUNT(*) AS c FROM dividends").fetchone()["c"]

    total_return = round(
        totals["unrealized_pl"] + totals["realized_pl"] + totals["dividends_net"], 2
    )
    total_return_pct = (
        round(total_return / totals["invested"] * 100, 2) if totals["invested"] > EPS else 0.0
    )

    with_prev = [r for r in active if r["day_change"] is not None]
    day_change = round(sum(r["day_change"] for r in with_prev), 2) if with_prev else None
    prev_value = sum(r["prev_price"] * r["shares"] for r in with_prev)
    day_change_pct = round(day_change / prev_value * 100, 2) if with_prev and prev_value > EPS else None

    return {
        "summary": {
            "invested": totals["invested"],
            "current_value": totals["current_value"],
            "unrealized_pl": totals["unrealized_pl"],
            "unrealized_return_pct": totals["return_pct"],
            "realized_pl": totals["realized_pl"],
            "dividends_net": totals["dividends_net"],
            "fees_paid": totals["fees_paid"],
            "total_return": total_return,
            "total_return_pct": total_return_pct,
            "day_change": day_change,
            "day_change_pct": day_change_pct,
            "holdings_count": len(active),
            "stocks_count": stock_count,
            "transactions_count": txn_count,
            "dividends_count": div_count,
        },
        "allocation": [
            {"symbol": r["symbol"], "value": r["current_value"], "weight_pct": r["weight_pct"]}
            for r in active
        ],
        "holdings": active,
    }
