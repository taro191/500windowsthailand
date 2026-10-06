// Thai ⇄ English switch that rewrites the rendered DOM text in place, ported from the
// design export. The UI is authored in Thai; English comes from the phrase tables below.
// Each text node remembers its Thai original, so switching back is lossless.
import translations from './translations'
import { translationOverrides } from './translationOverrides'

export type Language = 'th' | 'en'

interface TranslationState {
  th: string
  en: string
}

const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'alt', 'placeholder', 'title']

/** Longest phrases first, so "หน้าต่างประเทศไทย" wins over "หน้าต่าง". */
const entries = Object.entries({ ...translations, ...translationOverrides }).sort(
  ([a], [b]) => b.length - a.length,
)
const textStates = new WeakMap<Text, TranslationState>()
const attributeStates = new WeakMap<Element, Map<string, TranslationState>>()
const listeners = new Set<(language: Language) => void>()

let language: Language = 'th'
let observer: MutationObserver | undefined

function translate(value: string): string {
  let result = value
  for (const [thai, english] of entries) {
    if (result.includes(thai)) result = result.split(thai).join(english)
  }
  return result
}

function updateTextNode(node: Text) {
  const current = node.nodeValue ?? ''
  let state = textStates.get(node)
  // React replaced the text: remember the new Thai value.
  if (!state || (current !== state.th && current !== state.en)) {
    state = { th: current, en: translate(current) }
    textStates.set(node, state)
  }
  const next = language === 'en' ? state.en : state.th
  if (current !== next) node.nodeValue = next
}

function updateAttributes(element: Element) {
  let states = attributeStates.get(element)
  if (!states) {
    states = new Map()
    attributeStates.set(element, states)
  }
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue
    const current = element.getAttribute(attribute) ?? ''
    let state = states.get(attribute)
    if (!state || (current !== state.th && current !== state.en)) {
      state = { th: current, en: translate(current) }
      states.set(attribute, state)
    }
    const next = language === 'en' ? state.en : state.th
    if (current !== next) element.setAttribute(attribute, next)
  }
}

function updateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateTextNode(root as Text)
    return
  }
  if (root.nodeType === Node.ELEMENT_NODE) updateAttributes(root as Element)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) updateTextNode(node as Text)
    else updateAttributes(node as Element)
  }
}

/** Starts watching `root` so text React renders later is translated too. */
export function startDomTranslator(root: HTMLElement = document.body) {
  observer?.disconnect()
  updateTree(root)
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') updateAttributes(mutation.target as Element)
      else if (mutation.type === 'characterData') updateTextNode(mutation.target as Text)
      else mutation.addedNodes.forEach(updateTree)
    }
  })
  observer.observe(root, {
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
    characterData: true,
    childList: true,
    subtree: true,
  })
}

export function getLanguage(): Language {
  return language
}

export function setLanguage(next: Language) {
  language = next
  document.documentElement.lang = next
  updateTree(document.body)
  listeners.forEach((listener) => listener(next))
}

export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
