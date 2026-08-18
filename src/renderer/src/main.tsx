import './assets/main.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Overlay } from './Overlay'

// '#overlay' hash bilan ochilgan oyna — subtitle overlay rejimi
const isOverlay = window.location.hash === '#overlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>
)
