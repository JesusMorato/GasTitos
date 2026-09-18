// Iconos de interfaz "estilo GasTitos": trazo 2 px, esquinas redondas, rejilla 24.
// Mismo estilo que los iconos de categoría (lib/icons.ts). Nada de emojis en la UI.

export const UI_ICONS = {
  settings: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2.5"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  users: '<circle cx="8" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M13 20c0-2.8 1.8-5 3.8-5S21 17.2 21 20"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/>',
  transfer: '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  pencil: '<path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  check: '<path d="M5 12l4 4L19 6"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  arrowIn: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  arrowOut: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  grip: '<path d="M9 6h.01"/><path d="M15 6h.01"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M9 18h.01"/><path d="M15 18h.01"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="16" cy="13" r="1.5"/>',
  pig: '<path d="M5.2 9 4.6 3.9 9.1 5.9"/><path d="M18.8 9l.6-5.1-4.5 2"/><circle cx="12" cy="13.2" r="8"/><rect x="8.6" y="13.6" width="6.8" height="4.6" rx="2.3"/><path d="M11 15.9h.01"/><path d="M13 15.9h.01"/><path d="M8.6 10.6h.01"/><path d="M15.4 10.6h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
} as const

export type UiIconName = keyof typeof UI_ICONS
