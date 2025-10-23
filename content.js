// Content Script - Injetado em todas as páginas
// Por enquanto vazio, mas pode ser usado no futuro para:
// - Detectar páginas de videochamada específicas
// - Adicionar overlays ou botões nas páginas
// - Melhorar a captura de áudio em contextos específicos

console.log('Task Recorder Content Script carregado');

// Listener para mensagens do background ou popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
});