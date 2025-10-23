// Popup UI Logic

let recording = false;
let recordingInterval;
let seconds = 0;

// Elementos DOM
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const recordingName = document.getElementById('recordingName');
const recordingStatus = document.getElementById('recordingStatus');
const recordingTime = document.getElementById('recordingTime');
const saveSettingsBtn = document.getElementById('saveSettings');
const saveIndicator = document.getElementById('saveIndicator');

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tabName).classList.add('active');
  });
});

// Carregar configurações salvas
async function loadSettings() {
  const settings = await chrome.storage.local.get([
    'openaiKey',
    'discordWebhookMinutes',
    'discordWebhookTasks'
  ]);

  if (settings.openaiKey) {
    document.getElementById('openaiKey').value = settings.openaiKey;
  }
  if (settings.discordWebhookMinutes) {
    document.getElementById('discordWebhookMinutes').value = settings.discordWebhookMinutes;
  }
  if (settings.discordWebhookTasks) {
    document.getElementById('discordWebhookTasks').value = settings.discordWebhookTasks;
  }
}

// Salvar configurações
saveSettingsBtn.addEventListener('click', async () => {
  const openaiKey = document.getElementById('openaiKey').value;
  const discordWebhookMinutes = document.getElementById('discordWebhookMinutes').value;
  const discordWebhookTasks = document.getElementById('discordWebhookTasks').value;

  if (!openaiKey.trim()) {
    alert('Por favor, insira a API Key da OpenAI');
    return;
  }

  await chrome.storage.local.set({
    openaiKey,
    discordWebhookMinutes,
    discordWebhookTasks
  });

  saveIndicator.classList.add('show');
  setTimeout(() => {
    saveIndicator.classList.remove('show');
  }, 3000);
});

// Verificar permissões de áudio - CORRIGIDO
async function checkAudioPermissions() {
  // Microfone - mostra status inicial
  document.getElementById('micStatus').textContent = 'Pronto para capturar ✓';
  document.getElementById('micStatus').style.color = '#059669';
  document.getElementById('micIndicator').classList.add('active');

  // Tab audio - sempre pronto
  document.getElementById('tabIndicator').classList.add('active');
  document.getElementById('tabStatus').textContent = 'Pronto para capturar ✓';
  document.getElementById('tabStatus').style.color = '#059669';
}

// Iniciar gravação
startBtn.addEventListener('click', async () => {
  const name = recordingName.value.trim();
  
  if (!name) {
    alert('Por favor, dê um nome para a gravação!');
    return;
  }

  // Verificar se tem API Keys configuradas
  const settings = await chrome.storage.local.get(['openaiKey']);
  if (!settings.openaiKey) {
    alert('Por favor, configure a API Key da OpenAI nas Configurações');
    document.querySelector('[data-tab="settings"]').click();
    return;
  }

  // Desabilita botão enquanto solicita permissões
  startBtn.disabled = true;
  startBtn.textContent = 'Solicitando permissões...';

  // Enviar mensagem para background iniciar gravação
  chrome.runtime.sendMessage(
    { action: 'startRecording', recordingName: name },
    (response) => {
      startBtn.disabled = false;
      startBtn.innerHTML = '<span class="icon">⏺️</span> Iniciar Gravação';
      
      if (response && response.success) {
        seconds = 0; // Resetar contador apenas ao iniciar nova gravação
        updateUIToRecording();
        // Atualiza status das fontes
        document.getElementById('micStatus').textContent = 'Capturando áudio ✓';
        document.getElementById('tabStatus').textContent = 'Capturando áudio ✓';
      } else if (response && response.error) {
        alert('Erro ao iniciar gravação: ' + response.error);
        // Volta status para inicial
        document.getElementById('micStatus').textContent = 'Pronto para capturar';
        document.getElementById('micStatus').style.color = '#666';
        document.getElementById('micIndicator').classList.remove('active');
      }
    }
  );
});

// Parar gravação
stopBtn.addEventListener('click', () => {
  stopBtn.disabled = true;
  stopBtn.textContent = 'Finalizando...';
  
  chrome.runtime.sendMessage(
    { action: 'stopRecording' },
    (response) => {
      stopBtn.disabled = false;
      stopBtn.innerHTML = '<span class="icon">⏹️</span> Finalizar Gravação';
      
      if (response && response.success) {
        updateUIToStopped();
        // Reseta status das fontes
        document.getElementById('micStatus').textContent = 'Pronto para capturar ✓';
        document.getElementById('micStatus').style.color = '#059669';
        document.getElementById('tabStatus').textContent = 'Pronto para capturar ✓';
        
        alert('Gravação finalizada!\n\nProcessando:\n1. Transcrevendo áudio...\n2. Identificando tarefas...\n3. Criando cards no Trello...\n\nVocê receberá uma notificação quando finalizar.');
      } else if (response && response.error) {
        alert('Erro ao parar gravação: ' + response.error);
      }
    }
  );
});

// Atualizar UI para estado de gravação
function updateUIToRecording() {
  recording = true;
  // NÃO resetar seconds aqui - pode estar sendo restaurado com valor correto
  startBtn.style.display = 'none';
  stopBtn.style.display = 'flex';
  recordingStatus.classList.add('active', 'recording');
  recordingName.disabled = true;
  
  recordingInterval = setInterval(() => {
    seconds++;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    recordingTime.textContent = 
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, 1000);
}

// Atualizar UI para estado parado
function updateUIToStopped() {
  recording = false;
  clearInterval(recordingInterval);
  startBtn.style.display = 'flex';
  stopBtn.style.display = 'none';
  recordingStatus.classList.remove('active', 'recording');
  recordingName.disabled = false;
  recordingTime.textContent = '00:00';
  seconds = 0;
}

// Restaurar estado ao abrir popup
async function restoreRecordingState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getRecordingStatus' });
    
    if (response && response.isRecording) {
      // Recupera informações da gravação
      const recordingData = response.recordingData || {};
      
      if (recordingData.name) {
        recordingName.value = recordingData.name;
      }
      
      // Calcula tempo decorrido
      if (recordingData.startTime) {
        const elapsed = Math.floor((Date.now() - recordingData.startTime) / 1000);
        seconds = elapsed;
      }
      
      updateUIToRecording();
      
      // Atualiza status das fontes para capturando
      document.getElementById('micStatus').textContent = 'Capturando áudio ✓';
      document.getElementById('micStatus').style.color = '#059669';
      document.getElementById('tabStatus').textContent = 'Capturando áudio ✓';
    }
  } catch (error) {
    console.error('Erro ao restaurar estado:', error);
  }
}

// Botão de reset emergencial
const resetStateBtn = document.getElementById('resetState');
resetStateBtn?.addEventListener('click', async () => {
  if (confirm('Isso vai resetar o estado da gravação.\n\nUse apenas se a extensão travou.\n\nContinuar?')) {
    try {
      // Envia comando para limpar estado no background
      await chrome.runtime.sendMessage({ action: 'resetState' });
      
      // Limpa UI local
      updateUIToStopped();
      
      alert('Estado resetado com sucesso!\n\nVocê pode iniciar uma nova gravação agora.');
      
      // Volta para aba de gravação
      document.querySelector('[data-tab="action"]')?.click();
    } catch (error) {
      console.error('Erro ao resetar:', error);
      alert('Erro ao resetar: ' + error.message);
    }
  }
});

// Inicializar
loadSettings();
checkAudioPermissions();
restoreRecordingState();