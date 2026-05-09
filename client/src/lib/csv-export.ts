export type CsvRow = readonly unknown[];

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = typeof value === "string" && CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: readonly CsvRow[]): string {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, rows: readonly CsvRow[]): void {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
