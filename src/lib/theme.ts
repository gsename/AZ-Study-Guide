export type Theme = 'light' | 'dark'

const KEY = 'study-guide-theme'

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(KEY, theme)
}

// Apply immediately on import to avoid a flash of the wrong theme.
applyTheme(getStoredTheme())
