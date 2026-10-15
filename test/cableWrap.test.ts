import { describe, expect, it } from 'vitest';
import { generateCableWrap, type WrapMeasure } from '../src/model/cableWrap';
import { printableBand } from '../src/model/media';
import { newDoc } from '../src/model/defaults';
import { estimateEpsonStrip } from '../src/printer/epsonGeometry';

// Deterministic measured glyph dimensions isolate geometry from installed fonts.
const measure: WrapMeasure = (text) => ({ width: Math.max(...text.split('\n').map((l) => l.length)), blockH: text.split('\n').length * 2, em: 2 });
const doc = () => newDoc({ media: { kind: 'epson', width: 12, tapeColor: '#fff', inkColor: '#000' }, marginStart: 1, marginEnd: 2 });

describe('measured cable-wrap packing', () => {
  it('fits the maximum number of complete multiline blocks without crossing margins', () => {
    const p = { text: 'AB\nCD', diameter: 10, gap: 0.5, overlap: 4 };
    const out = generateCableWrap(doc(), p, measure);
    const available = Math.PI * 10 - 3;
    expect(out.elements).toHaveLength(Math.floor((available + 0.5) / (4.2 + 0.5)));
    for (const e of out.elements) {
      const center = e.x + e.w / 2;
      expect(center - e.h / 2).toBeGreaterThanOrEqual(1);
      expect(center + e.h / 2).toBeLessThanOrEqual(Math.PI * 10 - 2);
      expect(e.text).toBe('AB\nCD');
      expect(e.rotation).toBe(270);
    }
    expect(out.length).toBeCloseTo(35.4);
    expect(out.marginStart).toBeUndefined(); // existing margins are retained
  });
  it.each([0, 1, 3])('anchors the rotated repeat group at the leading margin (repeat=%s)', (repeat) => {
    const out = generateCableWrap(doc(), { text: 'A\nB', diameter: 15, dir: 'along', gap: 0.6, repeat, overlap: 8 }, measure);
    const first = out.elements[0], last = out.elements.at(-1)!;
    const left = first.x + first.w / 2 - first.h / 2;
    const right = last.x + last.w / 2 + last.h / 2;
    expect(left).toBeCloseTo(1);
    expect(out.length! - right).toBeGreaterThan(8);
    expect(out.elements.every((e) => e.type === 'text' && e.text === 'A\nB')).toBe(true);
  });
  it('stacks horizontal repeats on separate lines across the tape, honoring zero gap', () => {
    const out = generateCableWrap(doc(), { text: 'ABCDE', diameter: 10, dir: 'around', gap: 0 }, measure);
    const band = printableBand('epson', 12);
    expect(out.elements).toHaveLength(Math.floor(band.height / 2.2));
    expect(new Set(out.elements.map((e) => e.x)).size).toBe(1);
    for (let i = 0; i < out.elements.length; i++) {
      const e = out.elements[i];
      expect(e.x).toBeCloseTo(1);
      expect(e.w).toBeCloseTo(Math.min(Math.PI * 10, out.length!) - 3);
      expect(e.y).toBeGreaterThanOrEqual(band.top);
      expect(e.y + e.h).toBeLessThanOrEqual(band.top + band.height + 1e-8);
      if (i) expect(e.y).toBeGreaterThanOrEqual(out.elements[i - 1].y + out.elements[i - 1].h - 1e-8);
    }
    expect(out.elements.every((e) => e.rotation === 0)).toBe(true);
  });
  it.each(['along', 'around'])('fits fewer blocks when another line is added (%s)', (dir) => {
    const single = generateCableWrap(doc(), { text: 'A', diameter: 10, dir }, measure);
    const multi = generateCableWrap(doc(), { text: 'A\nB', diameter: 10, dir }, measure);
    expect(multi.elements.length).toBeLessThan(single.elements.length);
  });
  it('keeps rotated repeats on separate local lines', () => {
    const out = generateCableWrap(doc(), { text: 'A', diameter: 10, dir: 'along', gap: 0.5 }, measure);
    for (let i = 1; i < out.elements.length; i++) {
      const previous = out.elements[i - 1], next = out.elements[i];
      expect(next.rotation).toBe(270);
      expect(next.y).toBeCloseTo(previous.y);
      expect(next.x + next.w / 2 - next.h / 2).toBeGreaterThanOrEqual(previous.x + previous.w / 2 + previous.h / 2);
    }
  });
  it('keeps explicit repeats within the available length, shrinking as needed', () => {
    const out = generateCableWrap(doc(), { text: 'A\nB', diameter: 6, repeat: 20, gap: 10 }, measure);
    expect(out.elements.length).toBeGreaterThan(0);
    expect(out.elements.length).toBeLessThanOrEqual(20);
    for (const e of out.elements) {
      expect(e.x + e.w / 2 - e.h / 2).toBeGreaterThanOrEqual(1 - 1e-8);
      expect(e.x + e.w / 2 + e.h / 2).toBeLessThanOrEqual(6 * Math.PI - 2 + 1e-8);
      expect(e.shrink).toBe(true);
    }
  });
  it('does not generate ink for empty text or exhausted margins', () => {
    expect(generateCableWrap(doc(), { text: ' \n ' }, measure).elements).toHaveLength(0);
    expect(generateCableWrap({ ...doc(), marginStart: 50 }, { text: 'A' }, measure).elements).toHaveLength(0);
  });
});

describe('C610 provisional physical estimate', () => {
  it('pads short designs but keeps the raster length separate', () => {
    expect(estimateEpsonStrip(10)).toEqual({ raster: 10, total: 21, lead: 5.5, trail: 5.5 });
    expect(estimateEpsonStrip(40)).toEqual({ raster: 40, total: 41, lead: 0.5, trail: 0.5 });
  });
});
