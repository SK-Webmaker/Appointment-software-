#!/usr/bin/env bash
# After the files are emailed: switch the link off and record delivery, so it is never delivered or paid twice.
# Usage: stripe-mark-delivered.sh plink_...
set -euo pipefail
curl -sS "https://api.stripe.com/v1/payment_links/$1" -d active=false -d "metadata[delivered]=$(date -u +%F)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);e=d.get("error");print(e["message"] if e else d["id"]+" delivered, link off")'
