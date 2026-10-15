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
  // Repetition always advances down the text's local line axis. Rotated text
  // stacks along the feed; horizontal text stacks across the printable band.
  const span = along ? available : band.h;
  const blockWidth = along ? band.h : available;
  const fit = measureText(text, style, blockWidth, span);
  // Include the same 0.1 mm raster safety used by fitText at each block edge.
  const natural = Math.max(0.2, fit.blockH + 0.2);
  const auto = Math.max(1, Math.floor((span + gap + 1e-8) / (natural + gap)));
  const requested = Math.max(0, Math.round(number(p.repeat, 0)));
  const minimum = fit.blockH / Math.max(0.5, fit.em) * 0.5 + 0.2;
  if (span < minimum) return { orientation: 'landscape', lengthMode: 'fixed', length, elements: [], guides: [] };
  const count = Math.min(100, requested || auto, Math.max(1, Math.floor(span / minimum)));
  const actualGap = count > 1 ? Math.max(0, Math.min(gap, (span - count * minimum) / (count - 1))) : 0;
  const extent = Math.min(natural, Math.max(0.01, (span - (count - 1) * actualGap) / count));
  // Start rotated wraps at the leading margin so all unused length stays on
  // the trailing end and can be covered by the printed section when wrapped.
  const origin = along ? start : band.y + (span - (count * extent + (count - 1) * actualGap)) / 2;
  const elements: TextElement[] = [];
  for (let i = 0; i < count; i++) {
    const center = origin + i * (extent + actualGap) + extent / 2;
    const centerX = along ? center : start + available / 2;
    const centerY = along ? band.y + band.h / 2 : center;
    const w = blockWidth, h = extent;
    elements.push({ ...style,
      id: `${style.id}-${i}`, generated: true, size: fit.em / PT_TO_MM,
      x: centerX - w / 2, y: centerY - h / 2,
      w, h, rotation: along ? 270 : 0 });
  }
  return { elements, orientation: 'landscape', lengthMode: 'fixed', length, guides: [] };
}
