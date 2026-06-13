'use client'

import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  if (theme === 'light') {
    document.documentElement.classList.add('light')
  } else {
    document.documentElement.classList.remove('light')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('kv-theme') as Theme | null) ?? 'dark'
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('kv-theme', next)
  }

  return { theme, toggle, isDark: theme === 'dark' }
}

/**
 * Watches the <html> class list and returns true when dark mode is active.
 * Use in components that can't receive theme as a prop (e.g. SVG charts).
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? !document.documentElement.classList.contains('light')
      : true
  )

  useEffect(() => {
    const update = () => setIsDark(!document.documentElement.classList.contains('light'))
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
