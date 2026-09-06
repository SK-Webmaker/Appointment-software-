// Stage the demo so App Store screenshots show a salon that is up and running,
// not one halfway through setup. Nothing here is fictional about the product —
// every screen is the real thing — only the salon is invented.
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]);
const set = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));

set('business_name', 'Aurelia Hair Studio');
set('business_email', 'hello@aureliahair.example');
set('business_phone', '03 9000 0000');
set('business_address', '212 High Street, Melbourne VIC');
set('setup_complete', '1');
set('default_password_active', '0');
set('handover_password_active', '0');

// Everything the checklist watches, so it has done its job and gone away.
set('resend_api_key', 're_demo_key_for_screenshots');
set('notif_from_email', 'Aurelia Hair Studio <bookings@aureliahair.example>');
set('sms_notifications_enabled', '1');
set('sms_provider', 'clicksend');
set('clicksend_username', 'aurelia');
set('clicksend_api_key', 'demo');
set('clicksend_from', '+61400000000');       // their own number: no ACMA line
set('pos_payment_link', 'https://pay.example/aurelia');
set('checklist_link_shared', '1');
set('checklist_app_installed', '1');
console.log('staged:', db.prepare("SELECT value FROM settings WHERE key='business_name'").get().value);
db.close();
