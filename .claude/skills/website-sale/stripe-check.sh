#!/usr/bin/env bash
# Read-only. Lists website-sale payment links and whether each has been paid / delivered.
# Output lines: STATUS<TAB>link_id<TAB>plan<TAB>business<TAB>client_email   (STATUS = PAID_NOT_DELIVERED | UNPAID | DELIVERED)
set -euo pipefail
S=https://api.stripe.com/v1
curl -sS "$S/payment_links?limit=100" | python3 -c '
import sys, json, subprocess
d = json.load(sys.stdin)
if d.get("error"): sys.exit("Stripe error: " + d["error"]["message"])
for l in d["data"]:
    m = l.get("metadata", {})
    if m.get("kind") != "website-sale": continue
    if m.get("delivered"): status = "DELIVERED"
    else:
        link_id = l["id"]
        r = json.loads(subprocess.check_output(["curl", "-sS", f"https://api.stripe.com/v1/checkout/sessions?payment_link={link_id}&status=complete&limit=5"]))
        paid = [s for s in r.get("data", []) if s.get("payment_status") == "paid"]
        status = "PAID_NOT_DELIVERED" if paid else "UNPAID"
    print("\t".join([status, l["id"], m.get("plan","handover"), m.get("business",""), m.get("client_email","")]))
'
