// Service Worker para gerenciar gravação e processamento

let isRecording = false;
let recordingData = {
  name: '',
  startTime: null,
  tabId: null
};

// Listener para mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    startRecording(request.recordingName)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Erro capturado:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.action === 'stopRecording') {
    stopRecording()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'getRecordingStatus') {
    sendResponse({ 
      isRecording, 
      recordingData: isRecording ? recordingData : null 
    });
  } else if (request.action === 'recordingStopped') {
    handleRecordingStopped(request.audioBlob);
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'resetState') {
    // Reset emergencial do estado
    console.warn('RESET MANUAL DO ESTADO');
    isRecording = false;
    updateBadge(false);
    recordingData = { name: '', startTime: null, tabId: null };
    sendResponse({ success: true });
  }
});

// Listener para detectar quando a aba é fechada durante gravação
chrome.tabs.onRemoved.addListener((tabId) => {
  if (isRecording && recordingData.tabId === tabId) {
    console.warn('Aba de gravação foi fechada!');
    isRecording = false;
    updateBadge(false);
    recordingData = { name: '', startTime: null, tabId: null };
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Task Recorder',
      message: 'Gravação cancelada: aba foi fechada'
    });
  }
});

async function startRecording(recordingName) {
  try {
    console.log('Iniciando gravação:', recordingName);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Nenhuma aba ativa encontrada');
    }

    console.log('Tab ID:', tab.id, 'URL:', tab.url);

    // Se não conseguir acessar a URL, tenta mesmo assim (pode ser Meet/Zoom)
    if (tab.url) {
      // Apenas bloqueia se for realmente uma página restrita
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('devtools://')) {
        throw new Error('Não é possível gravar em páginas internas do navegador. Por favor, abra uma página web normal (ex: youtube.com, google.com)');
      }
    }
    // Se tab.url é undefined mas tab.id existe, continua (pode ser Meet com permissões limitadas)

    recordingData = {
      name: recordingName,
      startTime: Date.now(),
      tabId: tab.id
    };

    // Tenta injetar o script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['recorder.js']
      });
      console.log('Script recorder.js injetado com sucesso');
    } catch (injectError) {
      console.error('Erro ao injetar script:', injectError);
      throw new Error('Não foi possível injetar script na aba. Verifique se a página permite extensões.');
    }

    // Aguarda um pouco para o script carregar
    await new Promise(resolve => setTimeout(resolve, 100));

    // Envia mensagem para iniciar captura
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'startCapture'
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Falha ao iniciar captura');
    }

    isRecording = true;
    updateBadge(true);
    console.log('Gravação iniciada com sucesso');

  } catch (error) {
    console.error('Erro ao iniciar gravação:', error);
    isRecording = false;
    updateBadge(false);
    throw error;
  }
}

async function stopRecording() {
  try {
    console.log('stopRecording chamado. Estado atual:', { isRecording, tabId: recordingData.tabId });
    
    if (!isRecording) {
      console.warn('Tentativa de parar gravação que não está ativa');
      // Limpa estado inconsistente
      recordingData = { name: '', startTime: null, tabId: null };
      updateBadge(false);
      return { success: false, error: 'Nenhuma gravação ativa' };
    }
    
    if (!recordingData.tabId) {
      console.error('Tab ID não encontrado no estado da gravação');
      isRecording = false;
      updateBadge(false);
      return { success: false, error: 'Erro interno: Tab ID perdido' };
    }

    try {
      await chrome.tabs.sendMessage(recordingData.tabId, {
        action: 'stopCapture'
      });
      console.log('Comando de parada enviado para tab:', recordingData.tabId);
    } catch (sendError) {
      console.error('Erro ao enviar mensagem para tab:', sendError);
      // Tab pode ter sido fechada, limpa o estado
      isRecording = false;
      updateBadge(false);
      recordingData = { name: '', startTime: null, tabId: null };
      return { success: false, error: 'Aba foi fechada ou não responde' };
    }
    
    return { success: true, message: 'Gravação finalizada' };
  } catch (error) {
    console.error('Erro ao parar gravação:', error);
    isRecording = false;
    updateBadge(false);
    recordingData = { name: '', startTime: null, tabId: null };
    return { success: false, error: error.message };
  }
}

async function handleRecordingStopped(audioBlobData) {
  console.log('Gravação parada, processando áudio...');
  
  try {
    const response = await fetch(audioBlobData);
    const audioBlob = await response.blob();
    
    console.log('Blob de áudio criado, tamanho:', audioBlob.size);
    
    isRecording = false;
    updateBadge(false);
    
    await processAudio(audioBlob, recordingData.name);
    
    recordingData = { name: '', startTime: null, tabId: null };
  } catch (error) {
    console.error('Erro ao processar gravação parada:', error);
    isRecording = false;
    updateBadge(false);
    recordingData = { name: '', startTime: null, tabId: null };
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Erro no Task Recorder',
      message: 'Falha ao processar áudio: ' + error.message
    });
  }
}

function updateBadge(recording) {
  if (recording) {
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function processAudio(audioBlob, recordingName) {
  try {
    console.log('Tamanho do áudio:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');

    // Obter configurações
    const { openaiKey, discordWebhookMinutes, discordWebhookTasks } = await chrome.storage.local.get([
      'openaiKey',
      'discordWebhookMinutes',
      'discordWebhookTasks'
    ]);

    if (!openaiKey) {
      throw new Error('API Key da OpenAI não configurada');
    }

    // 1. Transcrever com Whisper
    console.log('Transcrevendo áudio...');
    const transcription = await transcribeAudio(audioBlob, openaiKey);
    console.log('Transcrição completa:', transcription.length, 'caracteres');

    // 2. Extrair TAREFAS com GPT-4
    console.log('Extraindo tarefas...');
    const tasks = await extractTasks(transcription, openaiKey);
    console.log('Tarefas extraídas:', tasks.length);

    // 3. Gerar ATA com GPT-4
    console.log('Gerando ata da reunião...');
    const minutes = await generateMinutes(transcription, openaiKey, recordingName);
    console.log('Ata gerada:', minutes.summary.substring(0, 100) + '...');

    // 4. Enviar para Discord
    let sentMinutes = false;
    let sentTasks = false;

    if (discordWebhookMinutes) {
      console.log('Enviando ata para Discord...');
      await sendMinutesToDiscord(minutes, discordWebhookMinutes, recordingName);
      sentMinutes = true;
    }

    if (discordWebhookTasks && tasks.length > 0) {
      console.log('Enviando tarefas para Discord...');
      await sendTasksToDiscord(tasks, discordWebhookTasks, recordingName);
      sentTasks = true;
    }

    // 5. Notificar usuário
    let message = '';
    if (sentMinutes && sentTasks) {
      message = `Ata e ${tasks.length} tarefa(s) enviadas para Discord!`;
    } else if (sentMinutes) {
      message = 'Ata enviada para Discord!';
    } else if (sentTasks) {
      message = `${tasks.length} tarefa(s) enviadas para Discord!`;
    } else if (tasks.length === 0) {
      message = 'Ata gerada, mas nenhuma tarefa identificada.';
    } else {
      message = 'Processamento concluído, mas webhooks não configurados.';
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Task Recorder - Sucesso!',
      message: message
    });

  } catch (error) {
    console.error('Erro ao processar áudio:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Erro no Task Recorder',
      message: error.message
    });
  }
}

async function transcribeAudio(audioBlob, apiKey) {
  // Detecta o tipo do blob
  const blobType = audioBlob.type || 'audio/webm';
  console.log('Blob type:', blobType, 'Size:', audioBlob.size);
  
  // Determina a extensão do arquivo baseado no tipo
  let fileExtension = 'webm';
  if (blobType.includes('mp4')) fileExtension = 'mp4';
  else if (blobType.includes('mpeg')) fileExtension = 'mp3';
  else if (blobType.includes('wav')) fileExtension = 'wav';
  else if (blobType.includes('ogg')) fileExtension = 'ogg';
  else if (blobType.includes('webm')) fileExtension = 'webm';
  
  console.log('Extensão do arquivo:', fileExtension);
  
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${fileExtension}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || response.statusText;
    console.error('Erro detalhado do Whisper:', errorData);
    throw new Error(`Erro na transcrição: ${errorMsg}`);
  }

  const data = await response.json();
  return data.text;
}

async function extractTasks(transcription, apiKey) {
  const today = new Date();
  const currentDate = today.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const isoDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayOfWeek = today.toLocaleDateString('pt-BR', { weekday: 'long' });

  const prompt = `DATA ATUAL: ${currentDate} (${isoDate}) - ${dayOfWeek}

Analise a seguinte transcrição de uma reunião e extraia TODAS as tarefas mencionadas.

Para cada tarefa, identifique:
1. Título da tarefa (resumo curto e claro)
2. Descrição completa (incluindo contexto, perguntas/respostas relacionadas, detalhes importantes)
3. Responsável (se mencionado)
4. Prazo/Data de entrega (se mencionado, no formato YYYY-MM-DD)
5. Prioridade (se mencionada: alta, média, baixa)

IMPORTANTE SOBRE DATAS:
- HOJE é ${currentDate} (${dayOfWeek})
- "amanhã" = ${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
- "depois de amanhã" = ${new Date(today.getTime() + 172800000).toISOString().split('T')[0]}
- "esta semana" = use datas desta semana (não de 2022!)
- "próxima semana" = adicione 7 dias à data de hoje
- "próxima segunda" = encontre a próxima segunda-feira a partir de hoje
- Use SEMPRE o ano atual (${today.getFullYear()})

IMPORTANTE:
- Capture o contexto completo: se houver perguntas sobre a tarefa e respostas, inclua na descrição
- Se houver menção de prazo (ex: "até amanhã", "na próxima semana"), extraia e converta para data
- Agrupe informações relacionadas à mesma tarefa
- NUNCA use anos antigos como 2022 ou 2023

Retorne APENAS um JSON válido (sem markdown) no formato:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "assignee": "string ou null",
      "dueDate": "YYYY-MM-DD ou null",
      "priority": "alta|média|baixa ou null"
    }
  ]
}

Transcrição:
${transcription}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: `Você é um assistente especializado em extrair tarefas de transcrições de reuniões. A data de hoje é ${currentDate}. Use sempre o ano atual (${today.getFullYear()}) ao calcular datas.` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erro na extração de tarefas: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonContent);
  
  return parsed.tasks || [];
}

async function generateMinutes(transcription, apiKey, recordingName) {
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const prompt = `Crie uma ATA completa e profissional desta reunião.

ESTRUTURA DA ATA:
1. Resumo executivo (2-3 parágrafos)
2. Participantes (se mencionados)
3. Pontos principais discutidos (lista)
4. Decisões tomadas (lista)
5. Próximos passos (lista)

IMPORTANTE:
- Use linguagem formal e profissional
- Seja objetivo e direto
- Organize por tópicos claros
- Destaque decisões importantes
- Identifique participantes se mencionados

Retorne APENAS um JSON válido (sem markdown) no formato:
{
  "summary": "string - resumo executivo",
  "participants": ["string"] - lista de participantes ou [],
  "topics": ["string"] - pontos principais,
  "decisions": ["string"] - decisões tomadas,
  "nextSteps": ["string"] - próximos passos
}

Transcrição da reunião:
${transcription}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Você é um assistente especializado em criar atas de reuniões profissionais e bem estruturadas.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erro na geração da ata: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonContent);
  
  return {
    ...parsed,
    meetingName: recordingName,
    date: currentDate
  };
}

async function sendMinutesToDiscord(minutes, webhookUrl, recordingName) {
  const embed = {
    title: `📋 Ata: ${recordingName}`,
    description: minutes.summary,
    color: 0x667eea, // Roxo
    timestamp: new Date().toISOString(),
    fields: []
  };

  if (minutes.participants && minutes.participants.length > 0) {
    embed.fields.push({
      name: '👥 Participantes',
      value: minutes.participants.join(', '),
      inline: false
    });
  }

  if (minutes.topics && minutes.topics.length > 0) {
    embed.fields.push({
      name: '💬 Pontos Principais',
      value: minutes.topics.map((t, i) => `${i + 1}. ${t}`).join('\n'),
      inline: false
    });
  }

  if (minutes.decisions && minutes.decisions.length > 0) {
    embed.fields.push({
      name: '✅ Decisões',
      value: minutes.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n'),
      inline: false
    });
  }

  if (minutes.nextSteps && minutes.nextSteps.length > 0) {
    embed.fields.push({
      name: '🎯 Próximos Passos',
      value: minutes.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      inline: false
    });
  }

  embed.footer = {
    text: `Task Recorder • ${minutes.date}`
  };

  const payload = {
    embeds: [embed]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar ata para Discord: ${response.statusText}`);
  }
}

async function sendTasksToDiscord(tasks, webhookUrl, recordingName) {
  const embeds = tasks.map((task, index) => {
    const fields = [];

    if (task.assignee) {
      fields.push({
        name: '👤 Responsável',
        value: task.assignee,
        inline: true
      });
    }

    if (task.dueDate) {
      fields.push({
        name: '📅 Prazo',
        value: task.dueDate,
        inline: true
      });
    }

    if (task.priority) {
      const priorityEmoji = {
        'alta': '🔴',
        'média': '🟡',
        'baixa': '🟢'
      };
      fields.push({
        name: '⚡ Prioridade',
        value: `${priorityEmoji[task.priority] || ''} ${task.priority}`,
        inline: true
      });
    }

    return {
      title: `${index + 1}. ${task.title}`,
      description: task.description,
      color: task.priority === 'alta' ? 0xef4444 : task.priority === 'média' ? 0xf59e0b : 0x10b981,
      fields: fields
    };
  });

  // Adiciona um embed de header
  const headerEmbed = {
    title: `📝 Tarefas Extraídas: ${recordingName}`,
    description: `${tasks.length} tarefa(s) identificada(s)`,
    color: 0x10b981, // Verde
    timestamp: new Date().toISOString()
  };

  const payload = {
    embeds: [headerEmbed, ...embeds]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar tarefas para Discord: ${response.statusText}`);
  }
}