from flask import Blueprint, jsonify, request

from db import get_db
from routes import valid_bs_date

bp = Blueprint("stocks", __name__, url_prefix="/api/stocks")


def row_to_dict(row):
    return dict(row)


@bp.get("")
def list_stocks():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM stocks ORDER BY symbol").fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    finally:
        conn.close()


@bp.post("")
def create_stock():
    data = request.get_json(force=True)
    symbol = (data.get("symbol") or "").strip().upper()
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400
    conn = get_db()
    try:
        existing = conn.execute("SELECT id FROM stocks WHERE symbol = ?", (symbol,)).fetchone()
        if existing:
            return jsonify({"error": f"Stock {symbol} already exists"}), 400
        cur = conn.execute(
            """INSERT INTO stocks (symbol, company, sector, current_price, price_updated)
               VALUES (?, ?, ?, ?, ?)""",
            (
                symbol,
                (data.get("company") or "").strip(),
                (data.get("sector") or "").strip(),
                float(data.get("current_price") or 0),
                data.get("price_updated"),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM stocks WHERE id = ?", (cur.lastrowid,)).fetchone()
        return jsonify(row_to_dict(row)), 201
    finally:
        conn.close()


@bp.put("/<int:stock_id>")
def update_stock(stock_id):
    data = request.get_json(force=True)
    symbol = (data.get("symbol") or "").strip().upper()
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400
    conn = get_db()
    try:
        dup = conn.execute(
            "SELECT id FROM stocks WHERE symbol = ? AND id != ?", (symbol, stock_id)
        ).fetchone()
        if dup:
            return jsonify({"error": f"Stock {symbol} already exists"}), 400
        conn.execute(
            """UPDATE stocks SET symbol = ?, company = ?, sector = ?,
               current_price = ?, price_updated = ? WHERE id = ?""",
            (
                symbol,
                (data.get("company") or "").strip(),
                (data.get("sector") or "").strip(),
                float(data.get("current_price") or 0),
                data.get("price_updated"),
                stock_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM stocks WHERE id = ?", (stock_id,)).fetchone()
        if not row:
            return jsonify({"error": "Stock not found"}), 404
        return jsonify(row_to_dict(row))
    finally:
        conn.close()


@bp.put("/<int:stock_id>/price")
def update_price(stock_id):
    data = request.get_json(force=True)
    try:
        price = float(data.get("current_price"))
    except (TypeError, ValueError):
        return jsonify({"error": "current_price must be a number"}), 400
    if price < 0:
        return jsonify({"error": "Price cannot be negative"}), 400
    price_updated = data.get("price_updated")
    if price_updated and not valid_bs_date(price_updated):
        return jsonify({"error": "price_updated must be a BS date like 2083-01-31"}), 400
    conn = get_db()
    try:
        conn.execute(
            "UPDATE stocks SET current_price = ?, price_updated = ? WHERE id = ?",
            (price, price_updated, stock_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM stocks WHERE id = ?", (stock_id,)).fetchone()
        if not row:
            return jsonify({"error": "Stock not found"}), 404
        return jsonify(row_to_dict(row))
    finally:
        conn.close()


@bp.delete("/<int:stock_id>")
def delete_stock(stock_id):
    conn = get_db()
    try:
        used = conn.execute(
            "SELECT COUNT(*) AS c FROM transactions WHERE stock_id = ?", (stock_id,)
        ).fetchone()["c"]
        used += conn.execute(
            "SELECT COUNT(*) AS c FROM dividends WHERE stock_id = ?", (stock_id,)
        ).fetchone()["c"]
        if used:
            return (
                jsonify({"error": "Stock has transactions or dividends; delete those first"}),
                400,
            )
        conn.execute("DELETE FROM stocks WHERE id = ?", (stock_id,))
        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()
