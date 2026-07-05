"""Fee engine tests — synthetic figures exercising every rule.

The engine itself was verified against the original Excel workbook;
these cases use made-up trades that cover the same math paths
(slab rates, Rs 10 commission floor, rounding, per-type fee rules).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fees import broker_commission, compute_fees, sebon_fee


def test_nabil_excel_anchor():
    # documented Excel row: NABIL BUY 10 @ 527.50
    f = compute_fees("BUY", 10, 527.50)
    assert f["gross"] == 5275.00
    assert f["commission"] == 18.99
    assert f["sebon_fee"] == 0.79
    assert f["dp_fee"] == 25.00
    assert f["net_amount"] == 5319.78


def test_buy_round_figures():
    # BUY 25 @ 400 -> gross 10000, comm 36.00 (0.36%), SEBON 1.50, DP 25
    f = compute_fees("BUY", 25, 400.00)
    assert f["gross"] == 10000.00
    assert f["commission"] == 36.00
    assert f["sebon_fee"] == 1.50
    assert f["dp_fee"] == 25.00
    assert f["net_amount"] == 10062.50


def test_buy_rounding():
    # BUY 9 @ 555.55 -> gross 4999.95; comm 17.99982 -> 18.00; SEBON 0.7499.. -> 0.75
    f = compute_fees("BUY", 9, 555.55)
    assert f["gross"] == 4999.95
    assert f["commission"] == 18.00
    assert f["sebon_fee"] == 0.75
    assert f["net_amount"] == 5043.70


def test_minimum_commission():
    # tiny trade: 0.36% of 1000 = 3.60 -> floor of Rs 10 applies
    assert broker_commission(1000) == 10.00
    # just above the floor: 0.36% of 3000 = 10.80
    assert broker_commission(3000) == 10.80


def test_commission_slabs():
    assert broker_commission(50_000) == 180.00       # 0.36%
    assert broker_commission(100_000) == 330.00      # 0.33%
    assert broker_commission(1_000_000) == 3100.00   # 0.31%
    assert broker_commission(5_000_000) == 13500.00  # 0.27%
    assert broker_commission(20_000_000) == 48000.00 # 0.24%


def test_commission_slab_edges():
    # an exact boundary amount stays in its slab (<= compare);
    # one rupee past it drops to the next slab's lower rate
    assert broker_commission(50_000) == 180.00        # 50000 * 0.36%
    assert broker_commission(50_001) == 165.00        # 50001 * 0.33% = 165.00033
    assert broker_commission(500_000) == 1650.00      # 500000 * 0.33%
    assert broker_commission(500_001) == 1550.00      # 500001 * 0.31% = 1550.0031
    assert broker_commission(2_000_000) == 6200.00    # 2000000 * 0.31%
    assert broker_commission(2_000_001) == 5400.00    # 2000001 * 0.27% = 5400.0027
    assert broker_commission(10_000_000) == 27000.00  # 10000000 * 0.27%
    assert broker_commission(10_000_001) == 24000.00  # 10000001 * 0.24% = 24000.0024


def test_half_up_rounding():
    # Excel ROUND is half away from zero; float round() gave 1.24 / 200.47
    assert sebon_fee(8300) == 1.25             # 8300 * 0.00015 = 1.245 exactly
    assert broker_commission(60750) == 200.48  # 60750 * 0.0033 = 200.475 exactly


def test_sell_deducts_fees():
    # SELL mirrors BUY but fees reduce proceeds
    f = compute_fees("SELL", 25, 400.00)
    assert f["gross"] == 10000.00
    assert f["net_amount"] == round(10000.00 - 36.00 - 1.50 - 25.00, 2)  # 9937.50


def test_ipo_no_fees():
    f = compute_fees("IPO", 10, 100)
    assert f == {
        "gross": 1000.00,
        "commission": 0.0,
        "sebon_fee": 0.0,
        "dp_fee": 0.0,
        "net_amount": 1000.00,
    }


def test_right_like_ipo():
    f = compute_fees("RIGHT", 5, 100)
    assert f["net_amount"] == 500.00
    assert f["commission"] == 0.0


def test_bonus_all_zero():
    f = compute_fees("BONUS", 10, 0)
    assert f["gross"] == 0.0
    assert f["net_amount"] == 0.0
