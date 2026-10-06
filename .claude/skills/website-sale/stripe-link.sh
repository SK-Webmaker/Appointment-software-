#!/usr/bin/env bash
# Create a one-off $350 AUD payment link for one client's website.
# Usage: stripe-link.sh "Business Name" client@email.com
# Auth: the environment's Stripe credential is added to api.stripe.com automatically.
set -euo pipefail
NAME="$1"; EMAIL="$2"; PRICE_CENTS="${PRICE_CENTS:-35000}"; CURRENCY="${CURRENCY:-aud}"
S=https://api.stripe.com/v1
json() { python3 -c 'import sys,json;d=json.load(sys.stdin);e=d.get("error");sys.exit("Stripe error: "+e["message"]) if e else print(d'"$1"')'; }

PRODUCT=$(curl -sS $S/products -d name="Website — $NAME" -d "metadata[kind]=website-sale" | json '["id"]')
PRICE=$(curl -sS $S/prices -d product="$PRODUCT" -d unit_amount="$PRICE_CENTS" -d currency="$CURRENCY" | json '["id"]')
curl -sS $S/payment_links \
  -d "line_items[0][price]=$PRICE" -d "line_items[0][quantity]=1" \
  -d "metadata[kind]=website-sale" -d "metadata[business]=$NAME" -d "metadata[client_email]=$EMAIL" \
  -d "restrictions[completed_sessions][limit]=1" \
  -d "custom_text[submit][message]=One-time payment. The website is yours to keep. Final sale once your files are delivered." \
  -d "after_completion[type]=hosted_confirmation" \
  -d "after_completion[hosted_confirmation][custom_message]=Thank you! Your website files are on their way to your email." \
  | json '["url"]+"  ("+d["id"]+", livemode="+str(d["livemode"])+")"'
