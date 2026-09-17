import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.js'
import './styles/theme.css'
import { installAppInsets } from './lib/appInsets.js'

// Before the first render, so the tab bar never paints under Android's
// navigation buttons and then jumps.
installAppInsets()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
