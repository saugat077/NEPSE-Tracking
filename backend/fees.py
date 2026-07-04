"""Fee engine for NEPSE equity transactions.

Pure functions, verified against known Excel rows (see tests/test_fees.py).
All amounts are rounded to 2 decimals, matching the Excel workbook.
"""

DP_FEE = 25.0            # flat Rs 25 per BUY/SELL transaction
SEBON_RATE = 0.00015     # 0.015% of gross
MIN_COMMISSION = 10.0    # broker commission floor

# NEPSE equity broker commission slabs: (upper bound of gross, rate)
COMMISSION_SLABS = [
    (50_000, 0.0036),
    (500_000, 0.0033),
    (2_000_000, 0.0031),
    (10_000_000, 0.0027),
    (float("inf"), 0.0024),
]


def broker_commission(gross):
    """Broker commission on gross amount, slab-based, minimum Rs 10."""
    for upper, rate in COMMISSION_SLABS:
        if gross <= upper:
            return round(max(gross * rate, MIN_COMMISSION), 2)
    raise AssertionError("unreachable")


def sebon_fee(gross):
    return round(gross * SEBON_RATE, 2)


def compute_fees(txn_type, quantity, price):
    """Return dict of gross, commission, sebon_fee, dp_fee, net_amount.

    BUY:  net = gross + commission + sebon + dp
    SELL: net = gross - commission - sebon - dp
    IPO / RIGHT: net = gross, no fees
    BONUS: everything 0 except quantity (price forced to 0 upstream)
    """
    txn_type = txn_type.upper()
    gross = round(quantity * price, 2)

    if txn_type in ("BUY", "SELL"):
        commission = broker_commission(gross)
        sebon = sebon_fee(gross)
        dp = DP_FEE
        if txn_type == "BUY":
            net = round(gross + commission + sebon + dp, 2)
        else:
            net = round(gross - commission - sebon - dp, 2)
        return {
            "gross": gross,
            "commission": commission,
            "sebon_fee": sebon,
            "dp_fee": dp,
            "net_amount": net,
        }

    if txn_type in ("IPO", "RIGHT"):
        return {
            "gross": gross,
            "commission": 0.0,
            "sebon_fee": 0.0,
            "dp_fee": 0.0,
            "net_amount": gross,
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
