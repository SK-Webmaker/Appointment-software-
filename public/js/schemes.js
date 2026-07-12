// Booking-page colour schemes — full palettes a business can pick to match
// their brand, beyond just the accent colour. Each is hand-tuned for contrast
// (not auto-inverted): dark schemes keep light text ≥ WCAG AA on their ground,
// light schemes keep dark text likewise.
export const SCHEMES = {
  midnight: {
    label: 'Midnight', mode: 'dark',
    bg: '#070a10', bgRaise: '#0a0e16', panel: '#0e1520', panel2: '#121a28', panel3: '#16202f',
    border: '#1c2636', borderSoft: '#151e2b', text: '#e8edf6', text2: '#9aa7bd', muted: '#64748b',
  },
  noir: {
    label: 'Noir', mode: 'dark',
    bg: '#0a0a0c', bgRaise: '#101013', panel: '#141418', panel2: '#1a1a20', panel3: '#212129',
    border: '#2a2a33', borderSoft: '#1f1f26', text: '#f0f0f2', text2: '#a8a8b3', muted: '#6e6e7a',
  },
  ocean: {
    label: 'Deep Ocean', mode: 'dark',
    bg: '#04121a', bgRaise: '#071822', panel: '#0a1e2a', panel2: '#0e2635', panel3: '#132e40',
    border: '#1c3a4d', borderSoft: '#142c3b', text: '#e6f2f7', text2: '#96b4c2', muted: '#5c7a89',
  },
  mocha: {
    label: 'Mocha', mode: 'dark',
    bg: '#140f0c', bgRaise: '#1a1410', panel: '#201914', panel2: '#281f19', panel3: '#30261e',
    border: '#3d2f24', borderSoft: '#2b211a', text: '#f2ece5', text2: '#bdab9a', muted: '#8a7562',
  },
  daylight: {
    label: 'Daylight', mode: 'light',
    bg: '#f5f7fa', bgRaise: '#ffffff', panel: '#ffffff', panel2: '#eef2f7', panel3: '#e5ebf4',
    border: '#d9e1ec', borderSoft: '#e6ecf4', text: '#131c2b', text2: '#4a5a70', muted: '#8895a9',
  },
  cream: {
    label: 'Cream', mode: 'light',
    bg: '#faf6ef', bgRaise: '#fffdf8', panel: '#fffdf8', panel2: '#f3ede1', panel3: '#ebe3d3',
    border: '#e2d8c4', borderSoft: '#ece4d4', text: '#2b2317', text2: '#6b5d48', muted: '#9c8d75',
  },
  blush: {
    label: 'Blush', mode: 'light',
    bg: '#fbf3f5', bgRaise: '#fffafb', panel: '#fffafb', panel2: '#f6e8ec', panel3: '#f0dde3',
    border: '#e9d0d8', borderSoft: '#f0dde3', text: '#2e1a21', text2: '#71505c', muted: '#a3808d',
  },
  sage: {
    label: 'Sage', mode: 'light',
    bg: '#f2f6f1', bgRaise: '#fbfdfa', panel: '#fbfdfa', panel2: '#e8efe6', panel3: '#dde8da',
    border: '#cfdccb', borderSoft: '#dfe8dc', text: '#1c261a', text2: '#4f6250', muted: '#7f9280',
  },
};

/**
 * Resolve a business's brand into the scheme to render.
 * brand_scheme wins when set; otherwise fall back to the older
 * light/dark brand_theme so existing businesses look unchanged.
 */
export function resolveScheme(brand) {
  if (brand?.scheme && SCHEMES[brand.scheme]) return SCHEMES[brand.scheme];
  return brand?.theme === 'light' ? SCHEMES.daylight : SCHEMES.midnight;
}

/** Apply a scheme's palette as CSS variables on the document root. */
export function applyScheme(scheme) {
  const r = document.documentElement.style;
  r.setProperty('--bg', scheme.bg);
  r.setProperty('--bg-raise', scheme.bgRaise);
  r.setProperty('--panel', scheme.panel);
  r.setProperty('--panel-2', scheme.panel2);
  r.setProperty('--panel-3', scheme.panel3);
  r.setProperty('--border', scheme.border);
  r.setProperty('--border-soft', scheme.borderSoft);
  r.setProperty('--text', scheme.text);
  r.setProperty('--text-2', scheme.text2);
  r.setProperty('--muted', scheme.muted);
  r.setProperty('--shadow', scheme.mode === 'light'
    ? '0 12px 30px rgba(16, 24, 40, 0.1)'
    : '0 12px 32px rgba(0, 0, 0, 0.45)');
  document.documentElement.dataset.brandTheme = scheme.mode; // keeps older per-mode CSS working
}
