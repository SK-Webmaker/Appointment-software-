// Post-payment landing for POS card sales (CSP-safe external script).
if (new URLSearchParams(location.search).get('cancelled')) {
  document.getElementById('card').className = 'card no';
  document.getElementById('badge').textContent = '···';
  document.getElementById('title').textContent = 'Payment not completed';
  document.getElementById('msg').textContent =
    'No charge was made. Hand the phone back to your stylist to try again or pay another way.';
} else {
  document.getElementById('card').className = 'card ok';
}
