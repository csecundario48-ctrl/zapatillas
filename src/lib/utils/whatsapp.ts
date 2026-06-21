// Build a wa.me link from a stored phone number.
// Defaults to Argentina (+54) when no country code is present.
export function waLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  // Prepend Argentina country code if it looks like a local number.
  if (!digits.startsWith('54')) digits = '54' + digits
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

const firstName = (name?: string | null) => (name ? ` ${name.split(' ')[0]}` : '')

// Reusable WhatsApp message templates (customer-facing).
export const waTemplates = {
  pedidoListo: (name?: string | null) =>
    `Hola${firstName(name)}! 👟 Tu pedido ya llegó y está listo para retirar. ¿Cuándo te queda cómodo pasar?`,
  tenemosTalle: (name?: string | null) =>
    `Hola${firstName(name)}! 👟 Buenas noticias: ya tenemos disponible el talle que buscabas. ¿Te lo reservo?`,
  nuevaColeccion: (name?: string | null) =>
    `Hola${firstName(name)}! 🔥 Llegó nueva colección 👟 ¿Querés que te pase fotos de lo nuevo?`,
}

export type WaTemplateKey = keyof typeof waTemplates

export const waTemplateLabels: Record<WaTemplateKey, string> = {
  pedidoListo: 'Llegó tu pedido',
  tenemosTalle: 'Tenemos tu talle',
  nuevaColeccion: 'Nueva colección',
}
