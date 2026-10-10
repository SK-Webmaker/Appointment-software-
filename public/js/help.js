// Where an owner goes for help. One place, so every "how do I…" link in Kairo
// — the Help page, the setup journey, the Guide links on each page — points at
// the same guide and the same person.
export const GUIDE_URL = 'https://kairobookings.com/guide';
export const SUPPORT_EMAIL = 'support@kairobookings.com';

// Inside the iPhone app the guide is opened in its plain form: the website
// around it sells Kairo, and the app links to nothing that sells (App Review
// 3.1.1). `?app=1` drops the sign-up buttons and the price.
const inNativeApp = () => typeof window !== 'undefined' && Boolean(window.kairoNative);

/** A link straight to one part of the guide. */
export const guideUrl = (section = '') => `${GUIDE_URL}${inNativeApp() ? '?app=1' : ''}${section ? `#${section}` : ''}`;

/** Which part of the guide each screen in Kairo is explained in. */
export const GUIDE_FOR_PAGE = {
  dashboard: 'dashboard', pos: 'point-of-sale', calendar: 'calendar', clients: 'clients', services: 'services',
  products: 'products', invoices: 'billing', messages: 'messages', reviews: 'reviews', growth: 'growth',
  staff: 'team', settings: 'settings', account: 'account', enquiries: 'enquiries',
};
