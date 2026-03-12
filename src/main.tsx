import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DMUnreadProvider } from './lib/DMUnreadContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DMUnreadProvider>
      <App />
    </DMUnreadProvider>
  </StrictMode>,
)
