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
export type ProjectionSettings = Record<ProjectionDimension, number> & { autoFit: boolean; mirror: boolean };
export const defaultProjectionSettings = Object.fromEntries([
  ...projectionFields.map(field => [field.key, field.value]), ['autoFit', true], ['mirror', false],
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
  return { ...value };
}

