import math

from flask import Blueprint, jsonify, request

from db import get_db
from fees import compute_fees
from holdings import current_shares
from routes import valid_bs_date

bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

VALID_TYPES = ("BUY", "SELL", "BONUS", "RIGHT", "IPO")


def parse_payload(data):
    """Validate common fields; return (payload, error_message)."""
    txn_type = (data.get("type") or "").strip().upper()
    if txn_type not in VALID_TYPES:
        return None, f"type must be one of {', '.join(VALID_TYPES)}"

    date = (data.get("date") or "").strip()
    if not valid_bs_date(date):
        return None, "date must be a BS date like 2083-01-31"

    try:
        quantity = float(data.get("quantity"))
    except (TypeError, ValueError):
        return None, "quantity must be a number"
    if not math.isfinite(quantity):  # JSON parser accepts NaN/Infinity literals
        return None, "quantity must be a number"
    if quantity <= 0:
        return None, "quantity must be greater than 0"

    if txn_type == "BONUS":
        price = 0.0  # BONUS forces price 0
    else:
        try:
            price = float(data.get("price"))
        except (TypeError, ValueError):
            return None, "price must be a number"
        if not math.isfinite(price):
            return None, "price must be a number"
        if price <= 0:
            return None, "price must be greater than 0"

    return {"type": txn_type, "date": date, "quantity": quantity, "price": price}, None


@bp.get("")
def list_transactions():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT t.*, s.symbol FROM transactions t
               JOIN stocks s ON s.id = t.stock_id
               ORDER BY t.date DESC, t.id DESC"""
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.post("/preview")
def preview():
    """Compute fees for the add-form live preview; nothing is saved."""
    data = request.get_json(force=True)
    txn_type = (data.get("type") or "BUY").strip().upper()
    if txn_type not in VALID_TYPES:
        return jsonify({"error": f"type must be one of {', '.join(VALID_TYPES)}"}), 400
    try:
        quantity = float(data.get("quantity") or 0)
        price = 0.0 if txn_type == "BONUS" else float(data.get("price") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "quantity and price must be numbers"}), 400
    if not math.isfinite(quantity) or quantity <= 0:
        return jsonify({"error": "quantity must be greater than 0"}), 400
    if txn_type != "BONUS" and (not math.isfinite(price) or price <= 0):
        return jsonify({"error": "price must be greater than 0"}), 400
    return jsonify(compute_fees(txn_type, quantity, price))


@bp.post("")
def create_transaction():
    data = request.get_json(force=True)
    payload, err = parse_payload(data)
    if err:
        return jsonify({"error": err}), 400

    conn = get_db()
    try:
        stock = conn.execute(
            "SELECT * FROM stocks WHERE id = ?", (data.get("stock_id"),)
        ).fetchone()
        if not stock:
            return jsonify({"error": "Stock not found — add it on the Stocks page first"}), 400

        if payload["type"] == "SELL":
            # validate as of the SELL's own date so a backdated SELL can't
            # borrow shares from a later BUY
            held = current_shares(conn, stock["id"], payload["date"])
            if payload["quantity"] > held + 1e-9:
                return (
                    jsonify(
                        {
                            "error": f"Cannot sell {payload['quantity']:g} — only "
                            f"{held:g} shares held as of {payload['date']}"
                        }
                    ),
                    400,
                )

        fees = compute_fees(payload["type"], payload["quantity"], payload["price"])
        cur = conn.execute(
            """INSERT INTO transactions
               (date, stock_id, type, quantity, price, gross, commission,
                sebon_fee, dp_fee, net_amount, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                payload["date"],
                stock["id"],
                payload["type"],
                payload["quantity"],
                payload["price"],
                fees["gross"],
                fees["commission"],
                fees["sebon_fee"],
                fees["dp_fee"],
                fees["net_amount"],
                (data.get("notes") or "").strip(),
            ),
        )
        conn.commit()
        row = conn.execute(
            """SELECT t.*, s.symbol FROM transactions t
               JOIN stocks s ON s.id = t.stock_id WHERE t.id = ?""",
            (cur.lastrowid,),
        ).fetchone()
        return jsonify(dict(row)), 201
    finally:
        conn.close()


@bp.delete("/<int:txn_id>")
def delete_transaction(txn_id):
    conn = get_db()
    try:
        txn = conn.execute(
            "SELECT stock_id FROM transactions WHERE id = ?", (txn_id,)
        ).fetchone()
        if not txn:
            return jsonify({"error": "Transaction not found"}), 404

        conn.execute("DELETE FROM transactions WHERE id = ?", (txn_id,))

        # Replay what's left for this stock before committing — deleting a
        # BUY that funds a later SELL would leave that SELL over-drawn and
        # corrupt derived holdings, so refuse instead.
        remaining = conn.execute(
            """SELECT type, quantity FROM transactions
               WHERE stock_id = ? ORDER BY date, id""",
            (txn["stock_id"],),
        ).fetchall()
        shares = 0.0
        for t in remaining:
            shares += -t["quantity"] if t["type"] == "SELL" else t["quantity"]
            if shares < -1e-9:
                conn.rollback()
                return (
                    jsonify(
                        {
                            "error": "Cannot delete — a later SELL would exceed "
                            "shares held; delete the SELL first"
                        }
                    ),
                    400,
                )

        conn.commit()
        return jsonify({"ok": True})
    finally:
        conn.close()
