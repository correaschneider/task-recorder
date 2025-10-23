// Script injetado na página para capturar áudio
// Este script roda no contexto da página, não no service worker

let mediaRecorder = null;
let audioChunks = [];
let micStream = null;
let tabStream = null;

// Listener para mensagens do background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startCapture()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'stopCapture') {
    stopCapture()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function startCapture() {
  try {
    console.log('[TaskRecorder] Iniciando captura de áudio...');
    
    // 1. Capturar microfone
    micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      } 
    });
    console.log('[TaskRecorder] Microfone capturado');

    // 2. Capturar áudio da aba (se houver)
    try {
      tabStream = await navigator.mediaDevices.getDisplayMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false 
      });
      console.log('[TaskRecorder] Áudio da aba capturado');
    } catch (error) {
      console.log('[TaskRecorder] Não foi possível capturar áudio da aba:', error.message);
      // Continua apenas com microfone
    }

    // 3. Combinar streams se tiver ambos
    let finalStream;
    
    if (tabStream && micStream) {
      const audioContext = new AudioContext();
      const micSource = audioContext.createMediaStreamSource(micStream);
      const tabSource = audioContext.createMediaStreamSource(tabStream);
      const destination = audioContext.createMediaStreamDestination();

      // Conecta ambas as fontes
      micSource.connect(destination);
      tabSource.connect(destination);

      finalStream = destination.stream;
      console.log('[TaskRecorder] Streams combinados');
    } else {
      // Usa apenas microfone
      finalStream = micStream;
      console.log('[TaskRecorder] Usando apenas microfone');
    }

    // 4. Iniciar gravação
    audioChunks = [];
    
    // Tenta usar formato que o Whisper aceita
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/ogg;codecs=opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = ''; // Deixa o browser escolher
    }
    
    console.log('[TaskRecorder] Usando mimeType:', mimeType || 'padrão do browser');
    
    mediaRecorder = new MediaRecorder(finalStream, mimeType ? {
      mimeType: mimeType
    } : {});

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log('[TaskRecorder] Gravação parada, enviando áudio...');
      
      // Cria blob do áudio
      const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      
      console.log('[TaskRecorder] Blob criado:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Converte para base64 para enviar ao background
      const reader = new FileReader();
      reader.onloadend = () => {
        chrome.runtime.sendMessage({
          action: 'recordingStopped',
          audioBlob: reader.result,
          mimeType: audioBlob.type
        });
      };
      reader.readAsDataURL(audioBlob);
      
      // Limpa streams
      cleanup();
    };

    mediaRecorder.onerror = (event) => {
      console.error('[TaskRecorder] Erro no MediaRecorder:', event.error);
      cleanup();
    };

    mediaRecorder.start(1000); // Captura a cada 1 segundo
    console.log('[TaskRecorder] Gravação iniciada!');

  } catch (error) {
    console.error('[TaskRecorder] Erro ao iniciar captura:', error);
    cleanup();
    throw error;
  }
}

async function stopCapture() {
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log('[TaskRecorder] Parando gravação...');
    }
  } catch (error) {
    console.error('[TaskRecorder] Erro ao parar captura:', error);
    cleanup();
    throw error;
  }
}

function cleanup() {
  console.log('[TaskRecorder] Limpando recursos...');
  
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  
  if (tabStream) {
    tabStream.getTracks().forEach(track => track.stop());
    tabStream = null;
  }
  
  audioChunks = [];
  mediaRecorder = null;
}

console.log('[TaskRecorder] Recorder script carregado');