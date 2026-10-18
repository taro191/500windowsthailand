// Applies the site themes chosen by the admins (see shared/themes.ts): variables go into one
// <style> element and each theme's stylesheet into a <link>, depending on the page being shown.
import type { RegionId } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { emptyActiveThemes, themeSelector, themeVariablesCss, type ActiveTheme, type ActiveThemes } from '@shared/themes'

export * from '@shared/themes'

let themes: ActiveThemes = emptyActiveThemes()
/** Theme an admin is trying out (`?theme-preview=<id>`): used for every scope in this tab. */
let preview: ActiveTheme | null = null
let view = 'welcome'
let region: RegionId = 'thailand'

const listeners = new Set<() => void>()
export const onPreviewChange = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
export const previewTheme = () => preview

export function setThemes(next: ActiveThemes | undefined) {
  themes = next ?? emptyActiveThemes()
  render()
}

export function setPreviewTheme(theme: ActiveTheme | null) {
  preview = theme
  render()
  listeners.forEach((l) => l())
}

/** Which page is showing: the admin area is never themed, region themes follow the open region. */
export function setThemeContext(nextView: string, nextRegion: RegionId) {
  view = nextView
  region = nextRegion
  render()
}

function render() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.view = view
  root.dataset.region = region

  const main = preview ?? themes.main
  const promo = preview ?? themes.promo
  const regionThemes = preview ? Object.fromEntries(REGION_IDS.map((r) => [r, preview!])) : themes.regions
  let css = main ? themeVariablesCss(themeSelector('main'), main.variables) : ''
  for (const r of REGION_IDS) {
    const theme = regionThemes[r]
    if (theme && theme.id !== main?.id) css += themeVariablesCss(themeSelector('region', r), theme.variables)
  }
  if (promo) css += themeVariablesCss(themeSelector('promo'), promo.variables)

  let style = document.getElementById('site-theme-vars') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'site-theme-vars'
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css

  // Stylesheets in cascade order: main, region, promo (promo CSS is scoped by its author).
  const site = view !== 'admin'
  const regionTheme = regionThemes[region]
  const hrefs = [
    site && main?.stylesheet,
    site && regionTheme && regionTheme.id !== main?.id && regionTheme.stylesheet,
    promo && (!site || promo.id !== main?.id) && promo.stylesheet,
  ].filter((href): href is string => !!href)
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[data-site-theme]')]
  if (links.map((l) => l.getAttribute('href')).join('|') === hrefs.join('|')) return
  links.forEach((l) => l.remove())
  for (const href of hrefs) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.siteTheme = ''
    document.head.appendChild(link)
  }
}
