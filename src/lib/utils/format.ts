export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Fecha en formato YYYY-MM-DD usando la hora LOCAL.
 * (toISOString usa UTC: en Argentina, después de las 21:00 devolvía
 * la fecha de mañana y las ventas quedaban registradas con el día corrido.)
 */
export function formatDateForInput(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Fecha YYYY-MM-DD en la zona horaria del negocio (Argentina).
 * Para código que corre en el servidor, donde la hora local es UTC.
 */
export function argDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
