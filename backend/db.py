import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "portfolio.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_db():
    """Return a sqlite3 connection with row access by name and FKs enforced."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create tables from schema.sql if they don't exist (idempotent) + migrate."""
    conn = get_db()
    try:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        _migrate(conn)
        conn.commit()
    finally:
        conn.close()


def _migrate(conn):
    """In-place upgrades for databases created before newer columns existed."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(stocks)")}
    if "prev_price" not in cols:
        conn.execute("ALTER TABLE stocks ADD COLUMN prev_price REAL NOT NULL DEFAULT 0")

    # seed price_history from current prices so the value chart has a first point
    empty = conn.execute("SELECT COUNT(*) AS c FROM price_history").fetchone()["c"] == 0
    if empty:
        conn.execute(
            """INSERT OR IGNORE INTO price_history (stock_id, date, price)
               SELECT id, price_updated, current_price FROM stocks
               WHERE current_price > 0 AND price_updated IS NOT NULL AND price_updated != ''"""
        )
