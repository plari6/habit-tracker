import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Api } from '@shared/types'
import App from './App'
import './index.css'

declare global {
  interface Window {
    api: Api
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
