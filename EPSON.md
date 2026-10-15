# Epson LabelWorks integration

Development branch: `epson-labelworks` in `pengsloth/labelpeel`.

## Current scope

- LW-C610 / LW-C610PX: 360 DPI, up to 256 printable dots across the tape.
- LW-PX400: 180 DPI, up to 128 printable dots across the tape.
- Separate LabelWorks tape sizes and command encoding; Brother commands are
  not sent to a connection opened with an Epson profile.
- Bluetooth Classic SPP through Web Serial or a paired outgoing COM port.
  Epson USB and Labelpeel native app transports have not been integrated.
- Existing editor, label templates, bitmaps, mirroring, copies and print preview.
- Full cut after each label, cut at job end, or no cut. Epson chain printing,
  half cutting, standalone feed/cut and cutting every N labels are not exposed.
- Status preflight requires idle, no error, and the exact designed tape width.
  Completion is tracked via Epson status, with polling and no automatic retry.

Select the Epson model in Printer before connecting. Model selection changes
the current label to compatible media; existing content is kept. When switching
models, disconnect first. Choose a 12 mm Epson label for the current C610 cartridge.
Preview resolution follows the model's DPI; physical screen size depends on the
display calibration. Printer-added blank length is not included in the bitmap.

## Hardware evidence

The original Wrapworks command path was repeatedly tested on C610 with 12 mm
212NYLBWPX nylon tape. The user also confirmed PX400 printing through that path,
but the old hardcoded 360 DPI produced oversized, clipped output. This branch
renders PX400 output at 180 DPI; that correction still needs physical validation.

12 mm Epson tape has 144 printable dots at 360 DPI (10.16 mm), or 72 at 180 DPI.
Normal cross-tape white borders are about 0.92 mm each. Sending a taller raster
on C610 did not expand the printable band. Zero added end margins already
caused automatic cut / print / cut. Tests on 12 mm nylon suggest a minimum
finished length around 20–21 mm; shorter raster images were padded. This is an
observation for that setup, not a guaranteed limit for every printer or tape.

The new encoder passes command-byte, orientation, cut, packet parsing and DPI
tests. A 30 mm LP1 calibration raster from the new encoder was sent via COM7 on
2026-10-14 with 24 mm tape (TW:05), 256 raster rows and zero added margins.
The C610 reported printing (ST:02), then print complete (ST:05), with ER:00.
Visual confirmation and validation of the integrated Labelpeel UI remain pending.

## Next work

- Confirm C610 operation from this branch, including a known-length calibration.
- Confirm corrected PX400 scale and printable band on actual hardware.
- Improve cable-wrap multiline auto-repeat using measured text block dimensions
  and user-selected text size / spacing (existing template repetition is heuristic).
- Show estimated printer-added end space separately from design margins.
- Integrate the proven Android connection route and test it in this application.

## Provenance

This implementation ports independently written Wrapworks framing and raster
packing. It includes no Epson SDK binaries or proprietary SDK source.
Public protocol research: <https://github.com/tyalie/RE-epson-label-printer/blob/main/protocol.md>.
