import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MtThemeProvider } from '@/theme/MtThemeProvider'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MtThemeProvider>
      <App />
    </MtThemeProvider>
  </StrictMode>,
)
