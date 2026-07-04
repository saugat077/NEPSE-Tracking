from flask import Blueprint, jsonify, request

from db import get_db
from routes import valid_bs_date

bp = Blueprint("dividends", __name__, url_prefix="/api/dividends")

PAR_VALUE = 100.0
TDS_RATE = 0.05


@bp.get("")
def list_dividends():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT d.*, s.symbol FROM dividends d
               JOIN stocks s ON s.id = d.stock_id
               ORDER BY d.date DESC, d.id DESC"""
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post("")
def create_dividend():
    data = request.get_json(force=True)
    date = (data.get("date") or "").strip()
    if not valid_bs_date(date):
        return jsonify({"error": "date must be a BS date like 2083-01-31"}), 400
    try:
        div_rate = float(data.get("div_rate"))
        shares = float(data.get("shares"))
    except (TypeError, ValueError):
        return jsonify({"error": "div_rate and shares must be numbers"}), 400
    if div_rate <= 0 or shares <= 0:
        return jsonify({"error": "div_rate and shares must be greater than 0"}), 400

    # gross = rate x par(100) x shares; TDS 5%
    gross = round(div_rate * PAR_VALUE * shares, 2)
    tds = round(gross * TDS_RATE, 2)
    net = round(gross - tds, 2)

    conn = get_db()
    try:
        stock = conn.execute(
            "SELECT id FROM stocks WHERE id = ?", (data.get("stock_id"),)
        ).fetchone()
        if not stock:
            return jsonify({"error": "Stock not found — add it on the Stocks page first"}), 400
        cur = conn.execute(
            """INSERT INTO dividends
               (date, stock_id, fiscal_year, div_rate, shares, gross, tds, net, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                date,
                stock["id"],
                (data.get("fiscal_year") or "").strip(),
                div_rate,
                shares,
                gross,
                tds,
                net,
                (data.get("notes") or "").strip(),
            ),
        )
        conn.commit()
        row = conn.execute(
            """SELECT d.*, s.symbol FROM dividends d
               JOIN stocks s ON s.id = d.stock_id WHERE d.id = ?""",
            (cur.lastrowid,),
        ).fetchone()
        return jsonify(dict(row)), 201
    finally:
        conn.close()


@bp.delete("/<int:div_id>")
def delete_dividend(div_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM dividends WHERE id = ?", (div_id,))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()
