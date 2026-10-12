#!/usr/bin/env bash
# Create a payment link (all prices in AUD).
# Usage: stripe-link.sh "Business Name" client@email.com <setup|managed|monthly-<dollars>> [reusable]
#   setup:    A$350 today (website + first year of hosting and domain), then A$20/year
#             "Annual Domain and Infrastructure", first charged 365 days after checkout (Stripe trial).
#   managed:  A$550 setup + A$24.99 first month today (A$574.99), then A$24.99 every month.
#   monthly-<dollars>: that amount every month, nothing up front (e.g. monthly-35). Cancel any time.
#   reusable: no one-payment limit. Every link asks the customer for their business name.
# Auth: the environment's Stripe credential is added to api.stripe.com automatically.
set -euo pipefail
NAME="$1"; EMAIL="$2"; PLAN="${3:?plan required}"; MODE="${4:-single}"; CURRENCY=aud
S=https://api.stripe.com/v1
json() { python3 -c 'import sys,json;d=json.load(sys.stdin);e=d.get("error");sys.exit("Stripe error: "+e["message"]) if e else print(d'"$1"')'; }
# product "<name>" "<description>"
product() { curl -sS $S/products --data-urlencode name="$1" --data-urlencode description="$2" -d "metadata[kind]=website-sale" -d "metadata[plan]=$PLAN" | json '["id"]'; }
FOR=""; [ "$NAME" != "your business" ] && FOR=" — $NAME"
EXTRA=()

case "$PLAN" in
  setup)
    P1=$(product "Website Setup$FOR" "A custom website built for your business. Includes the first year of hosting and domain registration. The domain is registered to you and belongs to you. Small content updates are A\$25 each.")
    P2=$(product "Annual Domain and Infrastructure$FOR" "A yearly contribution toward domain management, hosting configuration and basic technical upkeep. First charged 12 months after purchase.")
    ONE=$(curl -sS $S/prices -d product="$P1" -d unit_amount=35000 -d currency=$CURRENCY | json '["id"]')
    YR=$(curl -sS $S/prices -d product="$P2" -d unit_amount=2000 -d currency=$CURRENCY -d "recurring[interval]=year" | json '["id"]')
    ITEMS=(-d "line_items[0][price]=$ONE" -d "line_items[0][quantity]=1" -d "line_items[1][price]=$YR" -d "line_items[1][quantity]=1")
    EXTRA+=(-d "subscription_data[trial_period_days]=365")
    SUBMIT="Today: A\$350 website setup, including your first year of hosting and domain registration. Your domain is registered to you and belongs to you. From 12 months after today: A\$20 a year (Annual Domain and Infrastructure). Small content updates: A\$25 each."
    DONE="Thank you! We'll be in touch shortly to get your website live." ;;
  managed)
    P1=$(product "Website Setup (Managed)$FOR" "A custom website built, set up and launched for your business.")
    P2=$(product "Website Management$FOR" "Includes hosting and domain costs, ongoing support, unlimited routine updates to existing content, enhanced SEO, and website performance analytics on request. New pages, redesigns and new features are quoted separately.")
    ONE=$(curl -sS $S/prices -d product="$P1" -d unit_amount=55000 -d currency=$CURRENCY | json '["id"]')
    MO=$(curl -sS $S/prices -d product="$P2" -d unit_amount=2499 -d currency=$CURRENCY -d "recurring[interval]=month" | json '["id"]')
    ITEMS=(-d "line_items[0][price]=$ONE" -d "line_items[0][quantity]=1" -d "line_items[1][price]=$MO" -d "line_items[1][quantity]=1")
    SUBMIT="Today: A\$574.99 (A\$550 setup + A\$24.99 for your first month). Then A\$24.99 a month, charged automatically. Includes hosting and domain, support, unlimited routine updates to existing content, enhanced SEO and analytics on request. New pages, redesigns and new features are quoted separately."
    DONE="Thank you! We'll be in touch shortly to get your website live. For any changes, just message us." ;;
  monthly-*)
    AMT="${PLAN#monthly-}"; [[ "$AMT" =~ ^[0-9]+$ ]] || { echo "use monthly-<whole dollars>"; exit 1; }
    P=$(product "Website care, monthly$FOR" "Monthly website care.")
    PRICE=$(curl -sS $S/prices -d product="$P" -d unit_amount=$((AMT*100)) -d currency=$CURRENCY -d "recurring[interval]=month" | json '["id"]')
    ITEMS=(-d "line_items[0][price]=$PRICE" -d "line_items[0][quantity]=1")
    SUBMIT="A\$$AMT a month, charged automatically. No lock-in: cancel any time by messaging us."
    DONE="Thank you! You're all set. To cancel at any time, just message us." ;;
  *) echo "plan must be setup, managed or monthly-<dollars>"; exit 1 ;;
esac

if [ "$MODE" = reusable ]; then EXTRA+=(-d "metadata[reusable]=true")
else EXTRA+=(-d "restrictions[completed_sessions][limit]=1"); fi
EXTRA+=(-d "custom_fields[0][key]=business" -d "custom_fields[0][type]=text" -d "custom_fields[0][label][type]=custom" -d "custom_fields[0][label][custom]=Business name")

curl -sS $S/payment_links "${ITEMS[@]}" "${EXTRA[@]}" \
  -d "metadata[kind]=website-sale" -d "metadata[plan]=$PLAN" -d "metadata[business]=$NAME" -d "metadata[client_email]=$EMAIL" \
  --data-urlencode "custom_text[submit][message]=$SUBMIT" \
  -d "after_completion[type]=hosted_confirmation" \
  --data-urlencode "after_completion[hosted_confirmation][custom_message]=$DONE" \
  | json '["url"]+"  ("+d["id"]+", plan='"$PLAN"', livemode="+str(d["livemode"])+")"'
