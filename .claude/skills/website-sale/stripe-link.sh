#!/usr/bin/env bash
# Create a payment link for one client.
# Usage: stripe-link.sh "Business Name" client@email.com [handover|managed] [reusable]
#   reusable: no one-payment limit; the checkout asks for the business name. Never switch these off with stripe-mark-delivered.sh.
#   handover (default): $350 AUD once. Client keeps the site.
#   managed:            $550 AUD build + $30 AUD/month. Day one = $580 (Stripe bills month 1 at sign-up), then $30 monthly.
# Auth: the environment's Stripe credential is added to api.stripe.com automatically.
set -euo pipefail
NAME="$1"; EMAIL="$2"; PLAN="${3:-handover}"; MODE="${4:-single}"; CURRENCY=aud
S=https://api.stripe.com/v1
json() { python3 -c 'import sys,json;d=json.load(sys.stdin);e=d.get("error");sys.exit("Stripe error: "+e["message"]) if e else print(d'"$1"')'; }
product() { curl -sS $S/products -d name="$1" -d "metadata[kind]=website-sale" | json '["id"]'; }

case "$PLAN" in
  handover)
    P=$(product "Website — $NAME")
    PRICE=$(curl -sS $S/prices -d product="$P" -d unit_amount=35000 -d currency=$CURRENCY | json '["id"]')
    ITEMS=(-d "line_items[0][price]=$PRICE" -d "line_items[0][quantity]=1")
    SUBMIT="One-time payment. The website is yours to keep. Final sale once your files are delivered."
    DONE="Thank you! Your website files are on their way to your email." ;;
  managed)
    P1=$(product "Website build — $NAME")
    P2=$(product "Website management — $NAME")
    SETUP=$(curl -sS $S/prices -d product="$P1" -d unit_amount=55000 -d currency=$CURRENCY | json '["id"]')
    MONTHLY=$(curl -sS $S/prices -d product="$P2" -d unit_amount=3000 -d currency=$CURRENCY -d "recurring[interval]=month" | json '["id"]')
    ITEMS=(-d "line_items[0][price]=$SETUP" -d "line_items[0][quantity]=1" -d "line_items[1][price]=$MONTHLY" -d "line_items[1][quantity]=1")
    SUBMIT="Today: \$550 website + \$30 first month = \$580. Then \$30 a month for ongoing management and updates. Cancel any time by messaging us."
    DONE="Thank you! Your website is going live. For any changes, just message us." ;;
  *) echo "plan must be handover or managed"; exit 1 ;;
esac

if [ "$MODE" = reusable ]; then
  EXTRA=(-d "metadata[reusable]=true" -d "custom_fields[0][key]=business" -d "custom_fields[0][type]=text"
         -d "custom_fields[0][label][type]=custom" -d "custom_fields[0][label][custom]=Business name")
else
  EXTRA=(-d "restrictions[completed_sessions][limit]=1")
fi

curl -sS $S/payment_links "${ITEMS[@]}" "${EXTRA[@]}" \
  -d "metadata[kind]=website-sale" -d "metadata[plan]=$PLAN" -d "metadata[business]=$NAME" -d "metadata[client_email]=$EMAIL" \
  --data-urlencode "custom_text[submit][message]=$SUBMIT" \
  -d "after_completion[type]=hosted_confirmation" \
  --data-urlencode "after_completion[hosted_confirmation][custom_message]=$DONE" \
  | json '["url"]+"  ("+d["id"]+", plan='"$PLAN"', livemode="+str(d["livemode"])+")"'
