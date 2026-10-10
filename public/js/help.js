// Where an owner goes for help. One place, so every "how do I…" link in Kairo
// — the Help page, the setup journey, the tips — points at the same guide and
// the same person.
export const GUIDE_URL = 'https://kairobookings.com/guide';
export const SUPPORT_EMAIL = 'support@kairobookings.com';

/** A link straight to one part of the guide. */
export const guideUrl = (section = '') => (section ? `${GUIDE_URL}#${section}` : GUIDE_URL);
