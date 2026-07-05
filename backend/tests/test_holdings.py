"""Holdings aggregation tests — in-memory SQLite, pure stdlib (no Flask).

Covers the weighted-average-cost replay, BONUS dilution, as-of-date
SELL validation (a backdated SELL cannot borrow from a later BUY), and
dividend totals for stocks that have no transactions.
"""

import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from fees import compute_fees
from holdings import compute_holdings, current_shares


def make_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    with open(os.path.join(BASE_DIR, "schema.sql")) as f:
        conn.executescript(f.read())
    return conn


def add_stock(conn, symbol, current_price=0.0):
    cur = conn.execute(
        "INSERT INTO stocks (symbol, current_price) VALUES (?, ?)",
        (symbol, current_price),
    )
    return cur.lastrowid


def add_txn(conn, stock_id, date, txn_type, quantity, price):
    """Insert a transaction with fees computed the same way the API does."""
    fees = compute_fees(txn_type, quantity, price)
    conn.execute(
        """INSERT INTO transactions
           (date, stock_id, type, quantity, price, gross, commission,
            sebon_fee, dp_fee, net_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            date,
            stock_id,
            txn_type,
            quantity,
            price,
            fees["gross"],
            fees["commission"],
            fees["sebon_fee"],
            fees["dp_fee"],
            fees["net_amount"],
        ),
    )


def add_dividend(conn, stock_id, date, div_rate, shares):
    # gross = rate x par(100) x shares; TDS 5% (mirrors routes/dividends.py)
    gross = round(div_rate * 100.0 * shares, 2)
    tds = round(gross * 0.05, 2)
    net = round(gross - tds, 2)
    conn.execute(
        """INSERT INTO dividends (date, stock_id, div_rate, shares, gross, tds, net)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (date, stock_id, div_rate, shares, gross, tds, net),
    )


def find_row(rows, stock_id):
    return next(r for r in rows if r["stock_id"] == stock_id)


def test_buy_then_partial_sell():
    # BUY 10 @ 527.50 -> net 5319.78 (the NABIL Excel anchor), avg cost 531.978
    # SELL 4 @ 600 -> gross 2400, comm floor 10.00, SEBON 0.36, DP 25
    #   net proceeds 2364.64; cost removed 531.978 * 4 = 2127.912
    conn = make_db()
    sid = add_stock(conn, "NABIL", current_price=600.0)
    add_txn(conn, sid, "2082-01-05", "BUY", 10, 527.50)
    add_txn(conn, sid, "2082-02-10", "SELL", 4, 600.00)

    rows, totals = compute_holdings(conn)
    row = find_row(rows, sid)
    assert row["shares"] == 6
    assert row["invested"] == 3191.87        # 5319.78 - 2127.912
    assert row["avg_cost"] == 531.98         # unchanged by the SELL
    assert row["realized_pl"] == 236.73      # 2364.64 - 2127.912
    assert totals["realized_pl"] == 236.73
    assert totals["invested"] == 3191.87


def test_bonus_lowers_avg_cost_at_zero_cost():
    # BUY 10 @ 111 -> gross 1110, comm floor 10.00, SEBON 0.17, DP 25 -> net 1145.17
    conn = make_db()
    sid = add_stock(conn, "HBL")
    add_txn(conn, sid, "2082-01-05", "BUY", 10, 111.00)

    rows, _ = compute_holdings(conn)
    assert find_row(rows, sid)["avg_cost"] == 114.52  # 1145.17 / 10

    add_txn(conn, sid, "2082-03-01", "BONUS", 10, 0)
    rows, _ = compute_holdings(conn)
    row = find_row(rows, sid)
    assert row["shares"] == 20
    assert row["invested"] == 1145.17        # BONUS adds no cost
    assert row["avg_cost"] == 57.26          # 1145.17 / 20 — diluted


def test_current_shares_as_of_date():
    # the backdated-SELL hole: before the BUY date the position is 0,
    # so a SELL dated earlier than its funding BUY must not validate
    conn = make_db()
    sid = add_stock(conn, "NABIL")
    add_txn(conn, sid, "2082-05-01", "BUY", 10, 500.00)

    assert current_shares(conn, sid, "2082-04-30") == 0
    assert current_shares(conn, sid, "2082-05-01") == 10
    assert current_shares(conn, sid, "2082-06-15") == 10
    assert current_shares(conn, sid) == 10  # no date -> all transactions


def test_dividend_without_transactions_counts_in_totals():
    # NICA: BUY so the portfolio has one real row.  SANIMA: dividend only,
    # no transactions -> no holdings row, but the net must still total.
    conn = make_db()
    nica = add_stock(conn, "NICA", current_price=500.0)
    sanima = add_stock(conn, "SANIMA")
    add_txn(conn, nica, "2082-01-05", "BUY", 10, 500.00)
    add_dividend(conn, nica, "2082-04-01", 0.10, 10)      # net 95.00
    add_dividend(conn, sanima, "2082-04-01", 0.10, 100)   # net 950.00

    rows, totals = compute_holdings(conn)
    assert all(r["stock_id"] != sanima for r in rows)     # no txns -> no row
    assert find_row(rows, nica)["dividends_net"] == 95.00
    assert totals["dividends_net"] == 1045.00             # 95 + 950
