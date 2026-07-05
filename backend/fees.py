"""Fee engine for NEPSE equity transactions.

Pure functions, verified against known Excel rows (see tests/test_fees.py).
All amounts are computed in Decimal and rounded to 2 decimals half away
from zero, matching Excel's ROUND — plain float round() is banker's
rounding on binary floats and drifts on edge cases (e.g. SEBON on a
gross of 8300 is exactly 1.245 and must round to 1.25, not 1.24).
"""

from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")

DP_FEE = Decimal("25")           # flat Rs 25 per BUY/SELL transaction
SEBON_RATE = Decimal("0.00015")  # 0.015% of gross
MIN_COMMISSION = Decimal("10")   # broker commission floor

# NEPSE equity broker commission slabs: (upper bound of gross, rate)
COMMISSION_SLABS = [
    (50_000, Decimal("0.0036")),
    (500_000, Decimal("0.0033")),
    (2_000_000, Decimal("0.0031")),
    (10_000_000, Decimal("0.0027")),
    (float("inf"), Decimal("0.0024")),
]


def _round2(amount):
    """Excel-style ROUND to 2 decimals: half away from zero."""
    return amount.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _commission(gross):
    """Slab commission on a Decimal gross, as a Decimal."""
    for upper, rate in COMMISSION_SLABS:
        if gross <= upper:
            return _round2(max(gross * rate, MIN_COMMISSION))
    raise AssertionError("unreachable")


def _sebon(gross):
    """SEBON fee on a Decimal gross, as a Decimal."""
    return _round2(gross * SEBON_RATE)


def broker_commission(gross):
    """Broker commission on gross amount, slab-based, minimum Rs 10."""
    return float(_commission(Decimal(str(gross))))


def sebon_fee(gross):
    return float(_sebon(Decimal(str(gross))))


def compute_fees(txn_type, quantity, price):
    """Return dict of gross, commission, sebon_fee, dp_fee, net_amount.

    BUY:  net = gross + commission + sebon + dp
    SELL: net = gross - commission - sebon - dp
    IPO / RIGHT: net = gross, no fees
    BONUS: everything 0 except quantity (price forced to 0 upstream)
    """
    txn_type = txn_type.upper()
    gross = _round2(Decimal(str(quantity)) * Decimal(str(price)))

    if txn_type in ("BUY", "SELL"):
        commission = _commission(gross)
        sebon = _sebon(gross)
        dp = DP_FEE
        if txn_type == "BUY":
            net = _round2(gross + commission + sebon + dp)
        else:
            net = _round2(gross - commission - sebon - dp)
        return {
            "gross": float(gross),
            "commission": float(commission),
            "sebon_fee": float(sebon),
            "dp_fee": float(dp),
            "net_amount": float(net),
        }

    if txn_type in ("IPO", "RIGHT"):
        return {
            "gross": float(gross),
            "commission": 0.0,
            "sebon_fee": 0.0,
            "dp_fee": 0.0,
            "net_amount": float(gross),
        }

    if txn_type == "BONUS":
        return {
            "gross": 0.0,
            "commission": 0.0,
            "sebon_fee": 0.0,
            "dp_fee": 0.0,
            "net_amount": 0.0,
        }

    raise ValueError(f"Unknown transaction type: {txn_type}")
