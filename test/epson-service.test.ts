import { afterEach, describe, expect, it, vi } from 'vitest';
import { connect, disconnect, runJob, usePrinter, type PreparedJob } from '../src/printer/service';
import { profileById } from '../src/printer/profiles';
import { connectSerial, type Transport } from '../src/printer/transport';
import { epsonStatusRequest } from '../src/printer/epson';

vi.mock('../src/printer/transport', () => ({ connectSerial: vi.fn(), connectUsb: vi.fn(), isMac: () => false }));
vi.mock('../src/render/render', () => ({ renderPrintBitmap: vi.fn() }));
vi.mock('../src/render/assets', () => ({ preloadDoc: vi.fn() }));

const reply = (state: string, width = '03') => Uint8Array.from([
  ...new TextEncoder().encode(`@BDC ST\r\nST:${state};ER:00;TW:${width};`), 255,
]);

describe('Epson service routing', () => {
  afterEach(async () => { await disconnect(); vi.clearAllMocks(); });

  it('connects using Epson status bytes without Brother initialization', async () => {
    let queried = false;
    const write = vi.fn(async () => { queried = true; });
    const transport: Transport = { kind: 'serial', label: 'Test Epson', write, close: vi.fn(async () => undefined),
      read: async () => queried ? reply('00') : new Uint8Array() };
    vi.mocked(connectSerial).mockResolvedValue(transport);
    await connect('serial', profileById('epson-c610'));
    await vi.waitFor(() => expect(usePrinter.getState().responded).toBe(true));
    expect(write.mock.calls).toHaveLength(1);
    expect(write.mock.calls[0]).toEqual([epsonStatusRequest()]);
    expect(usePrinter.getState().status?.mediaWidth).toBe(12);
  });

  it('refuses a job with mismatched tape before sending any raster', async () => {
    let queried = false;
    const write = vi.fn(async () => { queried = true; });
    const transport: Transport = { kind: 'serial', label: 'Test Epson', write, close: vi.fn(async () => undefined),
      read: async () => queried ? reply('00', '04') : new Uint8Array() };
    const profile = profileById('epson-c610');
    usePrinter.setState({ transport, connectedProfile: profile });
    const job = { profile, options: { mediaWidth: 12 }, bitmaps: [], chunks: [Uint8Array.of(12)], bytes: 1 } as unknown as PreparedJob;
    await expect(runJob(job)).rejects.toThrow('matching tape width');
    expect(write.mock.calls).toHaveLength(1);
    expect(write.mock.calls[0]).toEqual([epsonStatusRequest()]);
    expect(usePrinter.getState().busy).toBe(false);
  });
});
