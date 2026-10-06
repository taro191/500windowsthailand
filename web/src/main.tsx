import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startDomTranslator } from './i18n/domTranslator'
import './index.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
startDomTranslator(root)
