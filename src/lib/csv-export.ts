export function escCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return ''
  let str = String(val)
  // Neutraliza CSV/formula injection: valores iniciados por = + - @ (ou TAB/CR) são
  // interpretados como fórmula pelo Excel/LibreOffice. Prefixa com apóstrofo.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  // Wrap in quotes if contains comma, newline or quote; escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function csvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escCsv).join(',')
}
