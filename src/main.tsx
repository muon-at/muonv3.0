import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DMUnreadProvider } from './lib/DMUnreadContext'
import { ChannelUnreadProvider } from './lib/ChannelUnreadContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChannelUnreadProvider>
      <DMUnreadProvider>
        <App />
      </DMUnreadProvider>
    </ChannelUnreadProvider>
  </StrictMode>,
)
