export type CsvValue = string | number | null | undefined

function escapeCsv(value: CsvValue): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Genera y descarga un CSV en el navegador, sin dependencias.
 * Separador `;` y BOM UTF-8: es lo que Excel/LibreOffice en locale es-AR
 * abren bien de una (coma decimal + acentos).
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const lines = [headers, ...rows].map(r => r.map(escapeCsv).join(';'))
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
