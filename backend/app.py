from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from db import init_db
from routes import dividends, portfolio, screener, stocks, transactions

# Built frontend — served by Flask so the whole app is one local server
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = Flask(__name__)
CORS(app)  # dev-only: allow the Vite dev server origin

init_db()

app.register_blueprint(stocks.bp)
app.register_blueprint(transactions.bp)
app.register_blueprint(dividends.bp)
app.register_blueprint(portfolio.bp)
app.register_blueprint(screener.bp)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/")
@app.get("/<path:path>")
def spa(path=""):
    """Serve the built frontend; unknown paths fall back to index.html (SPA routing)."""
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if not DIST.exists():
        return (
            "Frontend not built yet — run `npm run build` in frontend/, "
            "or use the Vite dev server (`npm run dev`).",
            503,
        )
    if path and (DIST / path).is_file():
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


if __name__ == "__main__":
    app.run(port=18345, debug=True)
