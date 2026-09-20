// Exportar a CSV pensado para abrirse en Excel en español: separador ";",
// decimales con coma, BOM UTF-8 para que respete los acentos.

export function csvCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return v.toFixed(2).replace('.', ',')
  const s = String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/**
 * En el móvil abre el menú de compartir (guardar en Archivos, mandar por WhatsApp…);
 * donde no exista, descarga el archivo. Hay que llamarla desde un toque del usuario.
 */
export async function shareOrDownload(filename: string, text: string, mime = 'text/csv') {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    const file = new File(['﻿' + text], filename, { type: mime })
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename })
      return
    }
  } catch (e) {
    // Cancelado por el usuario: no hacer nada. Otro error: se descarga.
    if ((e as Error).name === 'AbortError') return
  }
  downloadText(filename, text, mime)
}

/** Descarga un texto como archivo (funciona en móvil y escritorio). */
export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
