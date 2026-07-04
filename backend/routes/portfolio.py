from flask import Blueprint, jsonify

from db import get_db
from holdings import compute_dashboard, compute_holdings

bp = Blueprint("portfolio", __name__, url_prefix="/api")


@bp.get("/holdings")
def holdings():
    conn = get_db()
    try:
        rows, totals = compute_holdings(conn)
        return jsonify({"holdings": rows, "totals": totals})
    finally:
        conn.close()


@bp.get("/dashboard")
def dashboard():
    conn = get_db()
    try:
        return jsonify(compute_dashboard(conn))
    finally:
        conn.close()
