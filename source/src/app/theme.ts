export type Theme = 'dark' | 'light';

export function savedTheme(): Theme {
  try { return localStorage.getItem('inclusive-city-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem('inclusive-city-theme', theme); } catch { /* Settings still work without storage. */ }
}
