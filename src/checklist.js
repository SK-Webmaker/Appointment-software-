// What is left before this salon is really running.
//
// Computed from what is actually true — a key that exists, a booking that
// happened — rather than from ticks somebody clicked. Two items cannot be
// detected from here (whether the link is in their Instagram bio, whether the
// app is on their phone) and those are the only two that are ticks.
//
// It disappears entirely once everything required is done. A checklist that
// never goes away is furniture.
import { db, getSetting, publicUrl, platformHandles } from './db.js';

const on = (k, d = '0') => getSetting(k, d) === '1';
const set = (k) => String(getSetting(k, '') || '').trim() !== '';

/** A sender that is a name rather than a number is the one ACMA regulates. */
export const senderIsAlphaTag = () => {
  const from = String(getSetting('clicksend_from', '') || '').trim();
  return from !== '' && !/^\+?[0-9\s()-]+$/.test(from);
};

export function checklist() {
  const { platform_url: platform, connect_token: token } = platformHandles();
  const connectUrl = platform && token ? `${platform}/connect?t=${encodeURIComponent(token)}` : '';
  const onlineBookings = db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE source = 'online'").get().n;
  const items = [];

  items.push({
    id: 'email',
    title: 'Connect your email',
    why: 'Confirmations, reminders and receipts cannot send until this is done.',
    required: true,
    done: set('resend_api_key') && set('notif_from_email'),
    action: connectUrl ? { label: 'Set up my email', url: connectUrl, external: true }
      : { label: 'Open Notifications', hash: '#/settings' },
    note: connectUrl
      ? 'Two minutes. We do the technical part for you.'
      : 'Paste your Resend API key and From address in Settings → Notifications.',
  });

  const smsReady = on('sms_notifications_enabled') && set('clicksend_username') && set('clicksend_api_key') && set('clicksend_from');
  items.push({
    id: 'texts',
    title: 'Text reminders',
    why: 'Optional. Texts come from your own ClickSend account — you pay ClickSend about 6¢ a message and Kairo adds nothing.',
    required: false,
    done: smsReady,
    action: { label: 'Set up texts', hash: '#/settings' },
  });

  // Only when they chose a name rather than their own number: a number needs
  // no register, and most salons will never see this line.
  if (smsReady && senderIsAlphaTag()) {
    items.push({
      id: 'acma',
      title: `Register "${getSetting('clicksend_from')}" with ACMA`,
      why: 'Since 1 July 2026 a sender name must be registered, or carriers label your texts "Unverified". Your own mobile number needs no registration.',
      required: false,
      done: on('acma_registered'),
      action: { label: 'How to register', url: 'https://help.clicksend.com/en/articles/46062-acma-alphanumeric-senderids-alpha-tags-registration-usage', external: true },
      tickable: 'acma_registered',
    });
  }

  items.push({
    id: 'payments',
    title: 'Take card payments',
    why: 'Optional. Card money goes straight to your own account; Kairo never touches it.',
    required: false,
    done: set('stripe_secret_key') || getSetting('pos_card_method', '') === 'square' || set('pos_payment_link'),
    action: { label: 'Set up payments', hash: '#/settings' },
  });

  items.push({
    id: 'link',
    title: 'Share your booking link',
    why: 'Put it in your Instagram bio and your Google profile. It never changes.',
    required: false,
    done: on('checklist_link_shared'),
    detail: publicUrl() ? `${publicUrl()}/book` : '/book',
    tickable: 'checklist_link_shared',
    action: { label: 'Copy the link', copy: publicUrl() ? `${publicUrl()}/book` : '/book' },
  });

  items.push({
    id: 'test_booking',
    title: 'Take a test booking',
    why: 'See exactly what your customers see.',
    required: false,
    done: onlineBookings > 0,
    action: { label: 'Open my booking page', url: publicUrl() ? `${publicUrl()}/book` : '/book', external: true },
  });

  items.push({
    id: 'app',
    title: 'Put Kairo on your phone',
    why: 'You will open it twenty times a day.',
    required: false,
    done: on('checklist_app_installed'),
    tickable: 'checklist_app_installed',
    action: { label: 'How', hash: '#/settings' },
  });

  const requiredLeft = items.filter((i) => i.required && !i.done).length;
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    required_left: requiredLeft,
    // The whole thing hides once nothing required is outstanding AND the owner
    // has been through the optional ones once.
    complete: items.every((i) => i.done),
    show: !items.every((i) => i.done),
  };
}
