export function normalizeZebraPairs(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(12, Math.round(value))) : 4;
}

export function readZebraPairs() {
  try {
    const saved = localStorage.getItem('inclusive-city-zebra-pairs');
    return saved === null ? 4 : normalizeZebraPairs(Number(saved));
  } catch { return 4; }
}
