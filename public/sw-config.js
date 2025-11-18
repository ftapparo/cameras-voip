// Configuração para o Service Worker
// Este arquivo permite que o Workbox saiba quais URLs não devem ser cacheadas

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Não cachear WebSocket, streams, ou APIs
    if (
        url.includes('/stream/') ||
        url.includes('/api/') ||
        url.startsWith('wss://') ||
        url.startsWith('ws://') ||
        url.includes('.mp3')
    ) {
        // Deixar o request passar sem interceptar
        return;
    }
});
