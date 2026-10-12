#!/usr/bin/env bash
# After the files are emailed: switch the link off and record delivery, so it is never delivered or paid twice.
# Usage: stripe-mark-delivered.sh plink_... [retired]   ("retired" = switch off an old link without marking a delivery)
set -euo pipefail
KEY=delivered; [ "${2:-}" = retired ] && KEY=retired
curl -sS "https://api.stripe.com/v1/payment_links/$1" -d active=false -d "metadata[$KEY]=$(date -u +%F)" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);e=d.get("error");print(e["message"] if e else d["id"]+" switched off")'
