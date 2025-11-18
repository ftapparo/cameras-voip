//import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// Registrar Service Worker através do VitePWA
if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then(registrations => {
         registrations.forEach(registration => {
            console.log('Service Worker ativo:', registration);
         });
      });
   });
}

createRoot(document.getElementById('root')!).render(
   // <StrictMode>
   <App />
   // </StrictMode>,
)
