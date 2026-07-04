from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("screener", __name__, url_prefix="/api")

METRIC_FIELDS = ("eps", "pe", "npl", "roe", "car", "div_cash", "div_bonus")
VERDICTS = ("BUY", "WATCH", "AVOID", "STRONG AVOID")


@bp.get("/screener")
def get_screener():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM screener_metrics ORDER BY symbol, quarter"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


@bp.put("/screener")
def put_screener():
    """Upsert one or more metric rows by (symbol, quarter)."""
    data = request.get_json(force=True)
    entries = data if isinstance(data, list) else [data]
    conn = get_db()
    try:
        for entry in entries:
            symbol = (entry.get("symbol") or "").strip().upper()
            quarter = (entry.get("quarter") or "").strip()
            if not symbol or not quarter:
                return jsonify({"error": "symbol and quarter are required"}), 400
            verdict = entry.get("verdict")
            if verdict:
                verdict = verdict.strip().upper()
                if verdict not in VERDICTS:
                    return jsonify({"error": f"verdict must be one of {', '.join(VERDICTS)}"}), 400
            values = {}
            for f in METRIC_FIELDS:
                v = entry.get(f)
                if v in (None, ""):
                    values[f] = None
                else:
                    try:
                        values[f] = float(v)
                    except (TypeError, ValueError):
                        return jsonify({"error": f"{f} must be a number"}), 400
            conn.execute(
                """INSERT INTO screener_metrics
                   (symbol, quarter, eps, pe, npl, roe, car, div_cash, div_bonus, verdict)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(symbol, quarter) DO UPDATE SET
                     eps=excluded.eps, pe=excluded.pe, npl=excluded.npl,
                     roe=excluded.roe, car=excluded.car,
                     div_cash=excluded.div_cash, div_bonus=excluded.div_bonus,
                     verdict=excluded.verdict""",
                (
                    symbol,
                    quarter,
                    values["eps"],
                    values["pe"],
                    values["npl"],
                    values["roe"],
                    values["car"],
                    values["div_cash"],
                    values["div_bonus"],
                    verdict,
                ),
            )
        conn.commit()
        rows = conn.execute(
            "SELECT * FROM screener_metrics ORDER BY symbol, quarter"
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


def scores_with_ranks(conn):
    """All rank scores, with rank computed by sorting scores within each quarter."""
    rows = [dict(r) for r in conn.execute("SELECT * FROM rank_scores").fetchall()]
    by_quarter = {}
    for r in rows:
        by_quarter.setdefault(r["quarter"], []).append(r)
    for quarter_rows in by_quarter.values():
        quarter_rows.sort(key=lambda r: -r["score"])
        for i, r in enumerate(quarter_rows, start=1):
            r["rank"] = i
    rows.sort(key=lambda r: (r["quarter"], r["rank"]))
    return rows


@bp.get("/rank-history")
def get_rank_history():
    conn = get_db()
    try:
        return jsonify(scores_with_ranks(conn))
    finally:
        conn.close()


@bp.put("/rank-history")
def put_rank_history():
    """Upsert one or more scores by (symbol, quarter); response includes computed ranks."""
    data = request.get_json(force=True)
    entries = data if isinstance(data, list) else [data]
    conn = get_db()
    try:
        for entry in entries:
            symbol = (entry.get("symbol") or "").strip().upper()
            quarter = (entry.get("quarter") or "").strip()
            if not symbol or not quarter:
                return jsonify({"error": "symbol and quarter are required"}), 400
            try:
                score = float(entry.get("score"))
            except (TypeError, ValueError):
                return jsonify({"error": "score must be a number"}), 400
            conn.execute(
                """INSERT INTO rank_scores (symbol, quarter, score)
                   VALUES (?, ?, ?)
                   ON CONFLICT(symbol, quarter) DO UPDATE SET score=excluded.score""",
                (symbol, quarter, score),
            )
        conn.commit()
        return jsonify(scores_with_ranks(conn))
    finally:
        conn.close()
