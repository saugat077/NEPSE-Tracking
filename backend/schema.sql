-- NEPSE Portfolio Tracker — SQLite schema
-- All dates are Nepali (BS) calendar stored as TEXT, e.g. '2083-01-31'.

CREATE TABLE IF NOT EXISTS stocks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT NOT NULL UNIQUE,
    company       TEXT NOT NULL DEFAULT '',
    sector        TEXT NOT NULL DEFAULT '',
    current_price REAL NOT NULL DEFAULT 0,
    price_updated TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    stock_id   INTEGER NOT NULL REFERENCES stocks(id),
    type       TEXT NOT NULL CHECK (type IN ('BUY','SELL','BONUS','RIGHT','IPO')),
    quantity   REAL NOT NULL,
    price      REAL NOT NULL DEFAULT 0,
    gross      REAL NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    sebon_fee  REAL NOT NULL DEFAULT 0,
    dp_fee     REAL NOT NULL DEFAULT 0,
    net_amount REAL NOT NULL DEFAULT 0,
    notes      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dividends (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    stock_id    INTEGER NOT NULL REFERENCES stocks(id),
    fiscal_year TEXT NOT NULL DEFAULT '',
    div_rate    REAL NOT NULL,
    shares      REAL NOT NULL,
    gross       REAL NOT NULL,
    tds         REAL NOT NULL,
    net         REAL NOT NULL,
    notes       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS screener_metrics (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol    TEXT NOT NULL,
    quarter   TEXT NOT NULL,            -- e.g. 'Q3 2082/83'
    eps       REAL,
    pe        REAL,
    npl       REAL,
    roe       REAL,
    car       REAL,
    div_cash  REAL,
    div_bonus REAL,
    verdict   TEXT,                     -- BUY / WATCH / AVOID / STRONG AVOID
    UNIQUE (symbol, quarter)
);

CREATE TABLE IF NOT EXISTS rank_scores (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol  TEXT NOT NULL,
    quarter TEXT NOT NULL,
    score   REAL NOT NULL,
    UNIQUE (symbol, quarter)
);

CREATE INDEX IF NOT EXISTS idx_transactions_stock ON transactions(stock_id);
CREATE INDEX IF NOT EXISTS idx_dividends_stock    ON dividends(stock_id);
