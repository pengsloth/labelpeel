// LabelWorks framing verified with Wrapworks on the LW-C610. No Epson SDK code.
import type { PrintBitmap } from '../render/render';
import type { PrinterStatus } from './status';

export function epsonFrame(command: number, payload: number[] = []): Uint8Array {
  return Uint8Array.from([27, 123, payload.length + 3, command, ...payload,
    (command + payload.reduce((a, b) => a + b, 0)) & 255, 125]);
}
export const epsonStatusRequest = () => epsonFrame(81, [5, 0]);
export const epsonStatusStop = () => epsonFrame(81, [0, 0]);
const le = (n: number, size: number) => Array.from({ length: size }, (_, i) => (n >>> (i * 8)) & 255);

/** Raster columns carry the printable band, bottom pin first, MSB packed. */
export function buildEpsonJob(bitmaps: PrintBitmap[], cut: 'each' | 'end' | 'none'): Uint8Array[] {
  if (!bitmaps.length) throw new Error('No labels to print.');
  const chunks = [epsonFrame(64), epsonFrame(123, [0, 0, 83, 84]),
    epsonFrame(67, cut === 'none' ? [0, 0, 0, 0] : cut === 'each' ? [1, 1, 1, 1] : [1, 0, 1, 1]),
    epsonFrame(68, [5]), epsonFrame(71)];
  for (const b of bitmaps) {
    if (!Number.isInteger(b.width) || b.width < 1 || b.width > 100000 ||
        !Number.isInteger(b.height) || b.height < 1 || b.height > 256 || b.bits.length !== b.width * b.height) {
      throw new Error('Invalid Epson raster geometry.');
    }
    chunks.push(epsonFrame(76, le(b.width, 4)), epsonFrame(84, [0, 0]));
    const stride = 8 + Math.ceil(b.height / 8);
    const raster = new Uint8Array(b.width * stride);
    for (let x = 0; x < b.width; x++) {
      const offset = x * stride;
      raster.set([27, 46, 0, 0, 0, 1, b.height & 255, b.height >>> 8], offset);
      for (let y = 0; y < b.height; y++) {
        if (b.bits[(b.height - 1 - y) * b.width + x]) raster[offset + 8 + (y >>> 3)] |= 128 >>> (y & 7);
      }
    }
    chunks.push(raster, Uint8Array.of(12));
  }
  chunks.push(epsonFrame(64));
  return chunks;
}

export interface EpsonReply { state: number; status: PrinterStatus }
/** Ignore incomplete trailing packets; callers retain the buffer across reads. */
export function findEpsonStatus(bytes: Uint8Array): EpsonReply[] {
  const packets: Uint8Array[] = [];
  let start = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 64) start = i;
    if (bytes[i] === 255 && start >= 0) { packets.push(bytes.slice(start, i + 1)); start = -1; }
  }
  const replies: EpsonReply[] = [];
  const widths: Record<number, number> = { 11: 4, 1: 6, 2: 9, 3: 12, 4: 18, 5: 24 };
  for (const packet of packets) {
    const text = new TextDecoder().decode(packet);
    if (!text.startsWith('@BDC ST\r\n')) continue;
    const fields = Object.fromEntries([...text.matchAll(/([A-Z]{2}):([0-9A-F]{2})/g)].map((m) => [m[1], parseInt(m[2], 16)]));
    if (!['ST', 'ER', 'TW'].every((k) => k in fields)) continue;
    const state = fields.ST;
    replies.push({ state, status: {
      model: 0, battery: 0, errors: fields.ER ? [`Epson error 0x${fields.ER.toString(16).padStart(2, '0')}`] : [],
      mediaWidth: widths[fields.TW] ?? 0, mediaLength: 0, mediaType: 0x80, mediaTypeName: 'LabelWorks tape',
      statusType: state === 5 ? 1 : 0, statusTypeName: state === 5 ? 'Print complete' : state === 0 ? 'Idle' : `Epson state ${state}`,
      phase: state, tapeColor: 0, tapeColorName: 'Unknown', textColor: 0, textColorName: 'Unknown',
      raw: packet,
    } });
  }
  return replies;
}
