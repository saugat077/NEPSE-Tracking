import re

BS_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_bs_date(value):
    return bool(value) and bool(BS_DATE_RE.match(value))
