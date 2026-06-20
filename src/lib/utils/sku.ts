export function generateSku(brand: string, model: string, color: string, size: string): string {
  const normalize = (s: string) =>
    s.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
  return `${normalize(brand)}-${normalize(model)}-${normalize(color)}-${normalize(size)}`
}
