/** Provisional C610 estimate from 12 mm nylon tape, not a firmware guarantee.
 * Keep this out of raster construction: the printer supplies this blank space.
 */
export function estimateEpsonStrip(rasterMm: number) {
  const raster = Math.max(0, rasterMm);
  const total = Math.max(21, raster + 1);
  const blank = (total - raster) / 2;
  return { raster, total, lead: blank, trail: blank };
}
