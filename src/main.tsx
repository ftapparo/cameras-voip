//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { VoipCameraProvider } from './contexts/VoipCameraContext.tsx'

createRoot(document.getElementById('root')!).render(
    <VoipCameraProvider>
        <App />
    </VoipCameraProvider>
)
