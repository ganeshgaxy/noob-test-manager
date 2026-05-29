import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api.js'

export interface Branding {
  appTitle: string
  /** Base64 data URI (PNG or SVG) or null if no custom icon set. */
  iconData: string | null
}

const DEFAULT: Branding = { appTitle: 'noob-sdet', iconData: null }

interface BrandingContextValue {
  branding: Branding
  setBranding: (b: Branding, persist?: boolean) => Promise<void>
  resetBranding: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

function applyBranding(b: Branding) {
  document.title = b.appTitle

  // Favicon — use the uploaded icon if available, otherwise the default 🧪 emoji SVG
  let href: string
  if (b.iconData) {
    href = b.iconData
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧪</text></svg>`
    href = `data:image/svg+xml,${encodeURIComponent(svg)}`
  }
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBrandingState] = useState<Branding>(DEFAULT)

  useEffect(() => {
    api.branding
      .get()
      .then((b) => {
        const merged: Branding = { ...DEFAULT, ...b }
        setBrandingState(merged)
        applyBranding(merged)
      })
      .catch(() => applyBranding(DEFAULT))
  }, [])

  const setBranding = async (b: Branding, persist = true) => {
    setBrandingState(b)
    applyBranding(b)
    if (persist) await api.branding.update(b)
  }

  const resetBranding = async () => {
    const b = await api.branding.reset()
    const merged: Branding = { ...DEFAULT, ...b }
    setBrandingState(merged)
    applyBranding(merged)
  }

  return (
    <BrandingContext.Provider value={{ branding, setBranding, resetBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider')
  return ctx
}
