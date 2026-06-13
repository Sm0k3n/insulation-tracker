/**
 * Tiny CSV serializer/downloader. Escapes per RFC 4180 — fields containing
 * commas, quotes, or newlines get wrapped in quotes with internal quotes doubled.
 */
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const keys = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map(k => escape(k)).join(',');
  const lines = rows.map(r => keys.map(k => escape(r[k])).join(','));
  return [header, ...lines].join('\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Today's date string for filenames: `2026-06-12`. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
