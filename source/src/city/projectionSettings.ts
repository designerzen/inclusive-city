export const projectionFields = [
  { key: 'lineWidth', label: 'Line width', value: .16, min: .02, max: 3 },
  { key: 'barcodeWidth', label: 'Barcode width across the line', value: 1.44, min: .1, max: 10 },
  { key: 'barGap', label: 'Gap between bars', value: .16, min: .01, max: 3 },
  { key: 'shortLength', label: 'Short bar length (0)', value: .08, min: .01, max: 3 },
  { key: 'longLength', label: 'Long bar length (1)', value: .16, min: .02, max: 6 },
  { key: 'markerLength', label: 'Start / stop bar length', value: .32, min: .04, max: 12 },
  { key: 'codeGap', label: 'Minimum space between barcodes', value: .32, min: .01, max: 6 },
  { key: 'bendClearance', label: 'Clearance from bends', value: .4, min: .05, max: 5 },
] as const;
export type ProjectionDimension = typeof projectionFields[number]['key'];
export type BarcodeValue = { bits: number; value: number };
export const barcodeBitCounts = Array.from({ length: 16 }, (_, index) => index + 1);
export function barcodeCapacity(bits: number) {
  return `${bits} ${bits === 1 ? 'bit' : 'bits'} · ${2 ** bits} values (0–${2 ** bits - 1})`;
}
export type ProjectionSettings = Record<ProjectionDimension, number> & { autoFit: boolean; mirror: boolean; mirrorVertical: boolean; crossingCode: BarcodeValue; junctionCode: BarcodeValue };
export const defaultProjectionSettings = Object.fromEntries([
  ...projectionFields.map(field => [field.key, field.value]), ['autoFit', true], ['mirror', false], ['mirrorVertical', false],
  ['crossingCode', { bits: 4, value: 4 }], ['junctionCode', { bits: 4, value: 13 }],
]) as ProjectionSettings;

export function validateProjectionSettings(value: ProjectionSettings): ProjectionSettings {
  for (const field of projectionFields) {
    if (!Number.isFinite(value[field.key]) || value[field.key] < field.min || value[field.key] > field.max)
      throw new Error(`${field.label} must be between ${field.min} and ${field.max}.`);
  }
  if (value.longLength <= value.shortLength) throw new Error('Long bars must be longer than short bars.');
  if (value.markerLength <= value.longLength) throw new Error('Start / stop bars must be longer than data bars.');
  if (value.barcodeWidth <= value.lineWidth) throw new Error('Barcode width must be wider than the line.');
  if (typeof value.autoFit !== 'boolean') throw new Error('Choose whether barcodes can shrink to fit.');
  if (typeof value.mirror !== 'boolean') throw new Error('Choose whether to mirror the route.');
  if (typeof value.mirrorVertical !== 'boolean') throw new Error('Choose whether to reflect the route vertically.');
  for (const key of ['crossingCode', 'junctionCode'] as const) {
    const code = value[key];
    if (!code || !Number.isInteger(code.bits) || code.bits < 1 || code.bits > 16
      || !Number.isInteger(code.value) || code.value < 0 || code.value >= 2 ** code.bits)
      throw new Error('Choose a barcode with 1–16 bits and a value within its range.');
  }
  return { ...value, crossingCode: { ...value.crossingCode }, junctionCode: { ...value.junctionCode } };
}

export function eventBarcode(eventCode: number, settings: ProjectionSettings): BarcodeValue {
  return eventCode === 4 ? settings.crossingCode : eventCode === 13 ? settings.junctionCode : { bits: 4, value: eventCode };
}
