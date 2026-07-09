'use client'

import { Download } from 'lucide-react'
import { downloadCsv, type CsvValue } from '@/lib/utils/csv'

interface ExportCsvButtonProps {
  filename: string
  headers: string[]
  rows: CsvValue[][]
}

export function ExportCsvButton({ filename, headers, rows }: ExportCsvButtonProps) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, headers, rows)}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-foreground/10 bg-card text-foreground/70 text-sm hover:text-foreground hover:bg-foreground/[0.03] disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      <Download size={14} />
      CSV
    </button>
  )
}
