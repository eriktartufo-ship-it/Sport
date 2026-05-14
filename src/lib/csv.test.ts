import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsv, UTF8_BOM } from './csv';

describe('escapeCsvField', () => {
  it('lascia inalterato un campo senza caratteri speciali', () => {
    expect(escapeCsvField('Mario')).toBe('Mario');
  });

  it('wrappa con quote se contiene virgola', () => {
    expect(escapeCsvField('Mario, Bowser')).toBe('"Mario, Bowser"');
  });

  it('wrappa con quote se contiene doppio apice + raddoppia gli interni', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wrappa con quote se contiene newline o CR', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('toCsv', () => {
  type Row = { id: string; name: string; score: number; notes: string | null };

  const rows: Row[] = [
    { id: '1', name: 'Mario', score: 10, notes: null },
    { id: '2', name: 'Luigi, Jr.', score: 7, notes: 'good "match"' },
  ];

  it('genera header dalle label colonne', () => {
    const csv = toCsv(rows.slice(0, 0), [
      { label: 'ID', value: (r) => r.id },
      { label: 'Nome', value: (r) => r.name },
    ]);
    expect(csv).toBe('ID,Nome');
  });

  it('serializza number senza locale, stringhe escapate, null vuoto', () => {
    const csv = toCsv(rows, [
      { label: 'ID', value: (r) => r.id },
      { label: 'Nome', value: (r) => r.name },
      { label: 'Score', value: (r) => r.score },
      { label: 'Note', value: (r) => r.notes },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('ID,Nome,Score,Note');
    expect(lines[1]).toBe('1,Mario,10,');
    expect(lines[2]).toBe('2,"Luigi, Jr.",7,"good ""match"""');
  });

  it('usa CRLF tra righe (RFC 4180)', () => {
    const csv = toCsv(rows, [{ label: 'ID', value: (r) => r.id }]);
    expect(csv).toMatch(/^ID\r\n1\r\n2$/);
  });

  it('UTF8_BOM è il BOM corretto', () => {
    expect(UTF8_BOM).toBe('﻿');
    expect(UTF8_BOM.charCodeAt(0)).toBe(0xFEFF);
  });
});
