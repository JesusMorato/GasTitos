// Juego de iconos de categoría "estilo GasTitos", tomado del lienzo de diseño:
// trazo de 2 px, esquinas redondas, rejilla de 24. Cada icono lleva el color
// de la paleta que le corresponde; al elegirlo en Ajustes se aplica ese color.
// La clave (`key`) es lo que se guarda en la columna `icon` de la categoría:
// no cambies una clave existente (dejaría categorías sin icono).

export interface CategoryIconDef {
  key: string
  name: string
  color: string
  /** Grupo en el que aparece en el selector de Ajustes. */
  group: IconGroup
  /** Contenido del <svg> (trazos), sin la etiqueta svg. */
  svg: string
}

export const ICON_GROUPS = [
  'Básicos',
  'Casa y facturas',
  'Comida y salidas',
  'Transporte y viajes',
  'Ocio',
  'Personal y familia',
  'Dinero y trabajo',
] as const
export type IconGroup = (typeof ICON_GROUPS)[number]

export const CATEGORY_ICONS: readonly CategoryIconDef[] = [
  // --- los 10 de serie ---
  { key: 'casa', name: 'Casa', color: '#5b7fa6', group: 'Básicos', svg: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
  { key: 'comida', name: 'Comida', color: '#c8553d', group: 'Básicos', svg: '<path d="M6 3v7a3 3 0 0 0 6 0V3"/><path d="M9 13v8"/><path d="M18 3c-2 1-3 4-3 7h3v11"/>' },
  { key: 'transporte', name: 'Transporte', color: '#3a8f8f', group: 'Básicos', svg: '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="19.5" r="1.5"/><circle cx="16" cy="19.5" r="1.5"/>' },
  { key: 'ocio', name: 'Ocio', color: '#b05aa0', group: 'Básicos', svg: '<path d="M5 21 9 9l6 6-10 6z"/><path d="M13 5l1-2"/><path d="M17 8l2-1"/><path d="M16 12l3 1"/>' },
  { key: 'salud', name: 'Salud', color: '#4f9a6a', group: 'Básicos', svg: '<rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M12 13v4"/><path d="M10 15h4"/>' },
  { key: 'ropa', name: 'Ropa', color: '#c48a2e', group: 'Básicos', svg: '<path d="M8 4h8l4 4-3 3-1-1v10H8V10l-1 1-3-3 4-4z"/><path d="M9 4a3 3 0 0 0 6 0"/>' },
  { key: 'regalos', name: 'Regalos', color: '#d0587a', group: 'Básicos', svg: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v8h14v-8"/><path d="M12 9v12"/><path d="M12 9c-2 0-4-2-4-3.5S9.5 3 12 6c2.5-3 4-1.5 4-.5S14 9 12 9z"/>' },
  { key: 'viajes', name: 'Viajes', color: '#3c7bd1', group: 'Básicos', svg: '<path d="M21 3 3 10l8 3 3 8z"/><path d="M21 3 11 13"/>' },
  { key: 'suscripciones', name: 'Suscripciones', color: '#6b6bc4', group: 'Básicos', svg: '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M18 3v4h-4"/><path d="M6 21v-4h4"/>' },
  { key: 'otros', name: 'Otros', color: '#7a857f', group: 'Básicos', svg: '<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/>' },

  // --- casa y facturas ---
  { key: 'luz', name: 'Luz', color: '#c48a2e', group: 'Casa y facturas', svg: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6V15c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z"/>' },
  { key: 'agua', name: 'Agua', color: '#3c7bd1', group: 'Casa y facturas', svg: '<path d="M12 3s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>' },
  { key: 'gas', name: 'Gas y calefacción', color: '#c8553d', group: 'Casa y facturas', svg: '<path d="M12 3c.5 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5.5.3 1.7 1 2.8 2.2 3.5C12 9.5 11 6 12 3z"/>' },
  { key: 'internet', name: 'Internet', color: '#6b6bc4', group: 'Casa y facturas', svg: '<path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.5 12.5a9.5 9.5 0 0 1 13 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>' },
  { key: 'movil', name: 'Móvil', color: '#5b7fa6', group: 'Casa y facturas', svg: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18h2"/>' },
  { key: 'facturas', name: 'Facturas', color: '#7a857f', group: 'Casa y facturas', svg: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>' },
  { key: 'muebles', name: 'Muebles', color: '#8a6d4b', group: 'Casa y facturas', svg: '<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5z"/><path d="M6 18v2"/><path d="M18 18v2"/>' },
  { key: 'reparaciones', name: 'Reparaciones', color: '#8a6d4b', group: 'Casa y facturas', svg: '<path d="M15 4.5a4.5 4.5 0 0 0-5.3 5.8L3.8 16.2a2.1 2.1 0 0 0 3 3l5.9-5.9a4.5 4.5 0 0 0 5.8-5.3l-2.8 2.8-2.5-.5-.5-2.5z"/>' },
  { key: 'limpieza', name: 'Limpieza', color: '#3a8f8f', group: 'Casa y facturas', svg: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15v6"/><path d="M16 18h6"/>' },
  { key: 'jardin', name: 'Plantas', color: '#4f9a6a', group: 'Casa y facturas', svg: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 15c0-3-2.5-5-7-5 0 4 2.5 5 7 5z"/>' },

  // --- comida y salidas ---
  { key: 'super', name: 'Supermercado', color: '#4f9a6a', group: 'Comida y salidas', svg: '<path d="M3 4h2l2.5 11h11L21 8H6.3"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>' },
  { key: 'cafe', name: 'Café', color: '#8a6d4b', group: 'Comida y salidas', svg: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10.5h1a2.5 2.5 0 0 1 0 5h-1.3"/><path d="M8 3.5v2.5"/><path d="M12.5 3.5v2.5"/>' },
  { key: 'bar', name: 'Cañas', color: '#c48a2e', group: 'Comida y salidas', svg: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"/><path d="M15 11h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 8a2.5 2.5 0 0 1 2-4 3 3 0 0 1 5 0 2.5 2.5 0 0 1 3 4"/><path d="M8.5 12v5"/><path d="M11.5 12v5"/>' },
  { key: 'copas', name: 'Copas', color: '#b05aa0', group: 'Comida y salidas', svg: '<path d="M4 4h16l-8 9z"/><path d="M12 13v7"/><path d="M8 20h8"/><path d="M6.7 7h10.6"/>' },
  { key: 'rapida', name: 'Comida rápida', color: '#c8553d', group: 'Comida y salidas', svg: '<path d="M12 3 4 18.5a18 18 0 0 0 16 0L12 3z"/><path d="M11 10.5h.01"/><path d="M13.5 14h.01"/><path d="M9.5 15h.01"/>' },
  { key: 'dulces', name: 'Dulces', color: '#d0587a', group: 'Comida y salidas', svg: '<path d="M5 11h14l-2 10H7L5 11z"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M10 11l1 10"/><path d="M14 11l-1 10"/>' },

  // --- transporte y viajes ---
  { key: 'coche', name: 'Coche', color: '#5b7fa6', group: 'Transporte y viajes', svg: '<path d="M5 17H4a1 1 0 0 1-1-1v-3l2.2-5A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1l2.2 5v3a1 1 0 0 1-1 1h-1"/><path d="M3 13h18"/><path d="M10 17h4"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>' },
  { key: 'gasolina', name: 'Gasolina', color: '#c8553d', group: 'Transporte y viajes', svg: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h12"/><path d="M4 10h10"/><path d="M14 12h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3"/>' },
  { key: 'parking', name: 'Parking', color: '#3c7bd1', group: 'Transporte y viajes', svg: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>' },
  { key: 'tren', name: 'Tren y metro', color: '#3a8f8f', group: 'Transporte y viajes', svg: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><path d="M8.5 13.5h.01"/><path d="M15.5 13.5h.01"/><path d="M8 21l2-4"/><path d="M16 21l-2-4"/>' },
  { key: 'bici', name: 'Bici', color: '#4f9a6a', group: 'Transporte y viajes', svg: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h7l2.5 7.5"/><path d="M9 9l3.5 7.5h-7"/><path d="M7.5 6H10"/><path d="M16 9l-1-3h2"/>' },
  { key: 'avion', name: 'Avión', color: '#3c7bd1', group: 'Transporte y viajes', svg: '<path d="M10.5 13.5 4 12l-1-1.5 1.5-1 7 1 4.5-4.5a2.1 2.1 0 0 1 3 3l-4.5 4.5 1 7-1 1.5-1.5-1-1.5-6.5"/><path d="M8 16l-3 3"/>' },
  { key: 'hotel', name: 'Hotel', color: '#6b6bc4', group: 'Transporte y viajes', svg: '<path d="M3 5v15"/><path d="M3 15h18v5"/><path d="M11 15V9h7a3 3 0 0 1 3 3v3"/><circle cx="7" cy="11.5" r="2"/>' },
  { key: 'playa', name: 'Playa', color: '#c48a2e', group: 'Transporte y viajes', svg: '<circle cx="12" cy="10" r="4"/><path d="M12 2.5v1"/><path d="M4.5 10h1"/><path d="M18.5 10h1"/><path d="M6.7 4.7l.7.7"/><path d="M17.3 4.7l-.7.7"/><path d="M3 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/>' },
  { key: 'montana', name: 'Excursiones', color: '#4f9a6a', group: 'Transporte y viajes', svg: '<path d="M3 20 9.5 8l4 7 2-3L21 20z"/><path d="M7.5 11.7 9.5 13l2-1.5"/>' },

  // --- ocio ---
  { key: 'cine', name: 'Cine y series', color: '#b05aa0', group: 'Ocio', svg: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3.5 9 19 4.5l.6 2.3"/><path d="M8 7.7l2.2 2"/><path d="M13 6.3l2.2 2"/>' },
  { key: 'musica', name: 'Música', color: '#6b6bc4', group: 'Ocio', svg: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>' },
  { key: 'juegos', name: 'Videojuegos', color: '#3a8f8f', group: 'Ocio', svg: '<path d="M7 7h10a5 5 0 0 1 0 10c-1.5 0-2.5-1-3.5-2h-3c-1 1-2 2-3.5 2A5 5 0 0 1 7 7z"/><path d="M7.5 10.5v3"/><path d="M6 12h3"/><path d="M15.5 11h.01"/><path d="M17.5 13h.01"/>' },
  { key: 'deporte', name: 'Deporte', color: '#4f9a6a', group: 'Ocio', svg: '<circle cx="14" cy="4.5" r="1.5"/><path d="M6 21l3-6 3 2v4"/><path d="M9 15l1.5-5L7 11.5 5.5 9.5"/><path d="M10.5 10 14 8l2.5 4H19"/>' },
  { key: 'libros', name: 'Libros', color: '#8a6d4b', group: 'Ocio', svg: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5v-14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/><path d="M9 7.5h7"/>' },
  { key: 'foto', name: 'Fotografía', color: '#5b7fa6', group: 'Ocio', svg: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>' },
  { key: 'tele', name: 'Tele', color: '#6b6bc4', group: 'Ocio', svg: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M9 3l3 3 3-3"/>' },
  { key: 'tecnologia', name: 'Tecnología', color: '#5b7fa6', group: 'Ocio', svg: '<rect x="4" y="4.5" width="16" height="11" rx="2"/><path d="M2 19.5h20"/>' },

  // --- personal y familia ---
  { key: 'farmacia', name: 'Farmacia', color: '#4f9a6a', group: 'Personal y familia', svg: '<path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>' },
  { key: 'belleza', name: 'Peluquería', color: '#d0587a', group: 'Personal y familia', svg: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9"/><path d="M14.5 14.5 20 20"/><path d="M8.1 8.1 12 12"/>' },
  { key: 'gimnasio', name: 'Gimnasio', color: '#3a8f8f', group: 'Personal y familia', svg: '<path d="M6.5 7v10"/><path d="M3.5 9.5v5"/><path d="M17.5 7v10"/><path d="M20.5 9.5v5"/><path d="M6.5 12h11"/>' },
  { key: 'bebe', name: 'Bebé', color: '#d0587a', group: 'Personal y familia', svg: '<path d="M9 9h6v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V9z"/><path d="M8 9h8"/><path d="M10 9V7a2 2 0 0 1 4 0v2"/><path d="M12 3v2"/><path d="M9 13.5h3"/><path d="M9 17h3"/>' },
  { key: 'educacion', name: 'Estudios', color: '#5b7fa6', group: 'Personal y familia', svg: '<path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>' },
  { key: 'mascotas', name: 'Mascotas', color: '#c48a2e', group: 'Personal y familia', svg: '<circle cx="5" cy="10.5" r="2"/><circle cx="9" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="19" cy="10.5" r="2"/><path d="M12 12c-3 0-6 4-6 6.5 0 1.5 1.2 2.5 2.7 2.5.9 0 2-.6 3.3-.6s2.4.6 3.3.6c1.5 0 2.7-1 2.7-2.5C18 16 15 12 12 12z"/>' },
  { key: 'amor', name: 'Pareja', color: '#d0587a', group: 'Personal y familia', svg: '<path d="M12 20s-8-4.6-8-10.3A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.7C20 15.4 12 20 12 20z"/>' },
  { key: 'cumple', name: 'Cumpleaños', color: '#b05aa0', group: 'Personal y familia', svg: '<path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8"/><path d="M4 16c1.3 0 1.3-1 2.7-1s1.3 1 2.6 1 1.4-1 2.7-1 1.3 1 2.7 1 1.3-1 2.6-1 1.4 1 2.7 1"/><path d="M3 21h18"/><path d="M12 11V8"/><path d="M12 5.5c-.8-.7-.8-1.7 0-2.5.8.8.8 1.8 0 2.5z"/>' },

  // --- dinero y trabajo ---
  { key: 'trabajo', name: 'Trabajo', color: '#8a6d4b', group: 'Dinero y trabajo', svg: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>' },
  { key: 'banco', name: 'Banco e impuestos', color: '#2f6f5e', group: 'Dinero y trabajo', svg: '<path d="M3 10l9-6 9 6"/><path d="M4 21h16"/><path d="M6 10v8"/><path d="M10 10v8"/><path d="M14 10v8"/><path d="M18 10v8"/>' },
  { key: 'seguros', name: 'Seguros', color: '#3a8f8f', group: 'Dinero y trabajo', svg: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>' },
  { key: 'ahorro', name: 'Ahorro', color: '#2f6f5e', group: 'Dinero y trabajo', svg: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>' },
  { key: 'donaciones', name: 'Donaciones', color: '#d0587a', group: 'Dinero y trabajo', svg: '<path d="M2 15h3.5l3.5 2h4.5a1.5 1.5 0 0 1 0 3H9"/><path d="M13.5 20l5.5-2.5a1.6 1.6 0 0 1 1.5 2.8L14 23H6l-4-2"/><path d="M14 12s-4-2.3-4-5a2 2 0 0 1 4-.9 2 2 0 0 1 4 .9c0 2.7-4 5-4 5z"/>' },
]

export function iconByKey(key: string | null | undefined): CategoryIconDef | undefined {
  if (!key) return undefined
  return CATEGORY_ICONS.find((i) => i.key === key)
}

/** Iconos agrupados para el selector, en el orden de ICON_GROUPS. */
export function iconsByGroup(): Array<{ group: IconGroup; icons: CategoryIconDef[] }> {
  return ICON_GROUPS.map((group) => ({ group, icons: CATEGORY_ICONS.filter((i) => i.group === group) }))
}
