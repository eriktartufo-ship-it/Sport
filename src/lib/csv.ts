/**
 * Helper puro per generare CSV (RFC 4180). UTF-8 con CRLF tra le righe.
 * Test in src/lib/csv.test.ts.
 */

export type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

/** BOM UTF-8 per far riconoscere a Excel italiano l'encoding. */
export const UTF8_BOM = '﻿';

/**
 * Escape RFC 4180: se il campo contiene `,`, `"`, `\n` o `\r`, viene
 * racchiuso fra doppi apici e ogni doppio apice interno raddoppiato.
 */
export function escapeCsvField(input: string): string {
  if (/[",\n\r]/.test(input)) {
    return '"' + input.replace(/"/g, '""') + '"';
  }
  return input;
}

/**
 * Costruisce un CSV da rows + colonne dichiarate.
 * - Header = label delle colonne.
 * - Ogni valore null/undefined viene serializzato come stringa vuota.
 * - Number → stringa con Number.toString() (no localizzazione, evita
 *   conflitti col separator).
 * - Separator di campo: `,`. Separator di riga: `\r\n` (RFC 4180).
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.value(row);
        if (v === null || v === undefined) return '';
        return escapeCsvField(typeof v === 'number' ? String(v) : v);
      })
      .join(','),
  );
  return [header, ...body].join('\r\n');
}
