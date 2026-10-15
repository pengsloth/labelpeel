import { describe, expect, it } from 'vitest';
import { buildEpsonJob, epsonStatusRequest, findEpsonStatus } from '../src/printer/epson';
import { profileById } from '../src/printer/profiles';
import { printableBand, mmToDots } from '../src/model/media';
import { concat } from '../src/printer/protocol';
import type { PrintBitmap } from '../src/render/render';

const bitmap = (height = 9): PrintBitmap => ({ width: 2, height, bits: new Uint8Array(2 * height), lengthMm: 1, margin: 0, spill: null, spillDots: 0 });
const packet = (state: string, width = '03', error = '00') => concat([
  new TextEncoder().encode(`@BDC ST\r\nST:${state};ER:${error};WR:00;RV:00;TW:${width};TR:00;CT:00;OP:00;EI:00;`), Uint8Array.of(255),
]);

describe('Epson LabelWorks', () => {
  it('matches the hardware-tested Q status command', () => {
    expect([...epsonStatusRequest()]).toEqual([27, 123, 5, 81, 5, 0, 86, 125]);
  });
  it('preserves physical dimensions at 180 and 360 DPI', () => {
    const c610 = profileById('epson-c610'), px400 = profileById('epson-px400');
    expect(mmToDots(25.4, c610.dpi)).toBe(360);
    expect(mmToDots(25.4, px400.dpi)).toBe(180);
    const high = printableBand('epson', 12, c610.dpi, c610.headPins);
    const low = printableBand('epson', 12, px400.dpi, px400.headPins);
    expect(high.dots).toBe(144);
    expect(low.dots).toBe(72);
    expect(high.height).toBeCloseTo(10.16);
    expect(high.height).toBe(low.height);
    expect(printableBand('tze', 12, 360, 384).dots).toBe(150);
  });
  it('packs bottom-first columns with clean padding bits', () => {
    const b = bitmap();
    b.bits[8 * 2] = 1; // bottom left -> first bit
    b.bits[0] = 1; // top left -> first bit of final byte
    b.bits[7 * 2 + 1] = 1; // next column, next pin
    const raster = buildEpsonJob([b], 'end')[7];
    expect([...raster]).toEqual([27,46,0,0,0,1,9,0,128,128,27,46,0,0,0,1,9,0,64,0]);
  });
  it('encodes the three cut modes and separates pages', () => {
    expect([...buildEpsonJob([bitmap()], 'none')[2]]).toEqual([27,123,7,67,0,0,0,0,67,125]);
    expect([...buildEpsonJob([bitmap()], 'each')[2]]).toEqual([27,123,7,67,1,1,1,1,71,125]);
    expect([...buildEpsonJob([bitmap()], 'end')[2]]).toEqual([27,123,7,67,1,0,1,1,70,125]);
    expect(buildEpsonJob([bitmap(), bitmap()], 'end').filter((c) => c.length === 1 && c[0] === 12)).toHaveLength(2);
  });
  it('retains print-end even when immediately followed by idle', () => {
    const complete = packet('05');
    expect(findEpsonStatus(complete.slice(0, -1))).toEqual([]);
    const replies = findEpsonStatus(concat([Uint8Array.of(0), complete, packet('00')]));
    expect(replies.map((r) => r.state)).toEqual([5, 0]);
    expect(replies[0].status.mediaWidth).toBe(12);
    expect(findEpsonStatus(packet('00', '0B'))[0].status.mediaWidth).toBe(4);
    expect(findEpsonStatus(packet('00', '03', '01'))[0].status.errors).toHaveLength(1);
  });
});
