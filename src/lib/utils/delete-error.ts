/** Mensaje entendible para los errores de Postgres más comunes al borrar. */
export function deleteErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23503') {
    return 'No se puede borrar: hay registros que dependen de este elemento.'
  }
  return error.message
}
