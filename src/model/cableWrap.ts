import { makeText, printableRect } from './defaults';
import { PT_TO_MM } from './media';
import type { LabelDoc, TextElement } from './types';

export type WrapMeasure = (text: string, style: TextElement, width: number, height: number) => { width: number; blockH: number; em: number };
// Used without a DOM (e.g. file tooling). The browser registers its actual font
// measurements; the editor reflows generated wraps when fonts finish loading.
let measure: WrapMeasure = (text, style, width, height) => {
  const lines = text.split('\n');
  const w = Math.max(1, ...lines.map((l) => Array.from(l).length)) * 0.6;
  const h = (lines.length - 1) * style.lineHeight + 0.95;
  const em = Math.max(0.5, Math.min(style.size * PT_TO_MM, width / w, Math.max(0, height - 0.2) / h));
  return { width: w * em, blockH: h * em, em };
};
export function setWrapMeasure(fn: WrapMeasure) { measure = fn; }
const number = (v: unknown, fallback: number) => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;

export function generateCableWrap(doc: LabelDoc, p: Record<string, unknown>, measureText = measure): Partial<LabelDoc> & { elements: TextElement[] } {
  const landscape = { ...doc, orientation: 'landscape' as const };
  const band = printableRect(landscape);
  const circumference = Math.PI * Math.max(1, number(p.diameter, 6));
  const length = Math.round((circumference + Math.max(0, number(p.overlap, 0))) * 10) / 10;
  const start = Math.max(0, doc.marginStart), end = Math.max(0, doc.marginEnd);
  // Overlap is intentionally blank so it does not cover another text repeat.
  const available = Math.max(0, Math.min(circumference, length) - start - end);
  const gap = Math.max(0, number(p.gap, 0.6));
  const along = p.dir !== 'around';
  const text = typeof p.text === 'string' ? p.text : 'PSU-01';
  const style = makeText(landscape, text, { font: typeof p.font === 'string' ? p.font : 'Roboto Condensed',
    bold: p.bold === true || p.bold === 'true', size: Math.max(4, Math.min(72, number(p.textSize, 8))),
    lineHeight: 1.15, autoSize: false, autoWidth: false, shrink: true });
  if (available <= 0 || !text.trim()) return { orientation: 'landscape', lengthMode: 'fixed', length, elements: [], guides: [] };
  const fit = measureText(text, style, along ? band.h : available, along ? available : band.h);
  // Include the same 0.1 mm raster safety used by fitText at each block edge.
  const natural = Math.max(0.2, along ? fit.blockH + 0.2 : fit.width + 0.2);
  const auto = Math.max(1, Math.floor((available + gap + 1e-8) / (natural + gap)));
  const requested = Math.max(0, Math.round(number(p.repeat, 0)));
  const minimum = (along ? fit.blockH : fit.width) / Math.max(0.5, fit.em) * 0.5 + 0.2;
  if (available < minimum) return { orientation: 'landscape', lengthMode: 'fixed', length, elements: [], guides: [] };
  const count = Math.min(100, requested || auto, Math.max(1, Math.floor(available / minimum)));
  const actualGap = count > 1 ? Math.max(0, Math.min(gap, (available - count * minimum) / (count - 1))) : 0;
  const extent = Math.min(natural, Math.max(0.01, (available - (count - 1) * actualGap) / count));
  const origin = start + (available - (count * extent + (count - 1) * actualGap)) / 2;
  const elements: TextElement[] = [];
  for (let i = 0; i < count; i++) {
    const centerX = origin + i * (extent + actualGap) + extent / 2;
    const w = along ? band.h : extent, h = along ? extent : band.h;
    elements.push({ ...style,
      id: `${style.id}-${i}`, generated: true, size: fit.em / PT_TO_MM,
      x: centerX - w / 2, y: band.y + band.h / 2 - h / 2,
      w, h, rotation: along ? 270 : 0 });
  }
  return { elements, orientation: 'landscape', lengthMode: 'fixed', length, guides: [] };
}
