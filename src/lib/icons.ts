// Juego de iconos de categoría "estilo GasTitos", tomado del lienzo de diseño:
// trazo de 2 px, esquinas redondas, rejilla de 24. Cada icono lleva el color
// de la paleta que le corresponde; al elegirlo en Ajustes se aplica ese color.
// La clave (`key`) es lo que se guarda en la columna `icon` de la categoría.

export interface CategoryIconDef {
  key: string
  name: string
  color: string
  /** Contenido del <svg> (trazos), sin la etiqueta svg. */
  svg: string
}

export const CATEGORY_ICONS: readonly CategoryIconDef[] = [
  { key: 'casa', name: 'Casa', color: '#5b7fa6', svg: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
  { key: 'comida', name: 'Comida', color: '#c8553d', svg: '<path d="M6 3v7a3 3 0 0 0 6 0V3"/><path d="M9 13v8"/><path d="M18 3c-2 1-3 4-3 7h3v11"/>' },
  { key: 'transporte', name: 'Transporte', color: '#3a8f8f', svg: '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="19.5" r="1.5"/><circle cx="16" cy="19.5" r="1.5"/>' },
  { key: 'ocio', name: 'Ocio', color: '#b05aa0', svg: '<path d="M5 21 9 9l6 6-10 6z"/><path d="M13 5l1-2"/><path d="M17 8l2-1"/><path d="M16 12l3 1"/>' },
  { key: 'salud', name: 'Salud', color: '#4f9a6a', svg: '<rect x="3" y="9" width="18" height="12" rx="3"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M12 13v4"/><path d="M10 15h4"/>' },
  { key: 'ropa', name: 'Ropa', color: '#c48a2e', svg: '<path d="M8 4h8l4 4-3 3-1-1v10H8V10l-1 1-3-3 4-4z"/><path d="M9 4a3 3 0 0 0 6 0"/>' },
  { key: 'regalos', name: 'Regalos', color: '#d0587a', svg: '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v8h14v-8"/><path d="M12 9v12"/><path d="M12 9c-2 0-4-2-4-3.5S9.5 3 12 6c2.5-3 4-1.5 4-.5S14 9 12 9z"/>' },
  { key: 'viajes', name: 'Viajes', color: '#3c7bd1', svg: '<path d="M21 3 3 10l8 3 3 8z"/><path d="M21 3 11 13"/>' },
  { key: 'suscripciones', name: 'Suscripciones', color: '#6b6bc4', svg: '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M18 3v4h-4"/><path d="M6 21v-4h4"/>' },
  { key: 'otros', name: 'Otros', color: '#7a857f', svg: '<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/>' },
]

export function iconByKey(key: string | null | undefined): CategoryIconDef | undefined {
  if (!key) return undefined
  return CATEGORY_ICONS.find((i) => i.key === key)
}
