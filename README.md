# 🎙️ Task Recorder - Chrome Extension

Extensão Chrome que grava áudio de reuniões, transcreve automaticamente e cria tarefas no Trello baseadas no conteúdo da conversa.

## 📋 Funcionalidades

- ✅ Gravação simultânea de microfone + áudio da aba do navegador
- ✅ Transcrição automática com OpenAI Whisper
- ✅ Extração inteligente de tarefas com GPT-4
- ✅ Criação automática de cards no Trello com contexto completo
- ✅ Detecção de prazos, responsáveis e prioridades
- ✅ Interface moderna e intuitiva

## 🚀 Instalação

### 1. Estrutura de Arquivos

Crie uma pasta chamada `task-recorder` com os seguintes arquivos:

```
task-recorder/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### 2. Ícones

Você precisa criar 3 ícones para a extensão nas seguintes dimensões:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

**Dica rápida:** Use um gerador online como [favicon.io](https://favicon.io) ou crie manualmente um ícone simples com emoji 🎙️

### 3. Carregar no Chrome

1. Abra o Chrome e acesse: `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `task-recorder`
5. A extensão aparecerá na barra de ferramentas! 🎉

## ⚙️ Configuração

### 1. Obter API Keys

#### OpenAI API Key
1. Acesse: https://platform.openai.com/api-keys
2. Faça login ou crie uma conta
3. Clique em **Create new secret key**
4. Copie a chave (começa com `sk-`)
5. **Importante:** Você precisa ter créditos na conta OpenAI

#### Trello API Key e Token
1. Acesse: https://trello.com/power-ups/admin
2. Clique em **New** para criar uma Power-Up
3. Anote a **API Key**
4. Clique em **Token** (link ao lado da API Key)
5. Autorize e copie o **Token**

### 2. Configurar na Extensão

1. Clique no ícone da extensão Task Recorder
2. Vá na aba **Configurações**
3. Cole suas API Keys:
   - OpenAI API Key
   - Trello API Key
   - Trello Token
4. Clique em **Salvar Configurações**

## 📖 Como Usar

### Gravar uma Reunião

1. Abra uma aba com áudio (ex: Google Meet, Zoom, Microsoft Teams)
2. Clique no ícone da extensão
3. Digite um nome para a gravação (ex: "Daily 21/10/2025")
4. Certifique-se que os indicadores de áudio estão verdes ✅
5. Clique em **Iniciar Gravação**
6. Quando terminar, clique em **Finalizar Gravação**

### Processamento Automático

Após finalizar a gravação, a extensão:

1. 🎯 **Transcreve** o áudio com Whisper
2. 🤖 **Analisa** a transcrição com GPT-4
3. 📝 **Extrai** todas as tarefas mencionadas
4. 📋 **Cria** cards no Trello automaticamente

Você receberá uma notificação quando o processo for concluído!

### Board no Trello

- Um board chamado **"Task Recorder"** será criado automaticamente
- Todas as tarefas serão adicionadas na primeira lista
- Você pode reorganizar os cards como preferir

## 🎯 Extração Inteligente de Tarefas

A extensão consegue capturar:

### Contexto Completo
```
"Você poderia fazer um chá para nós?"
"Qual sabor você prefere?" → "Camomila"
"Qual temperatura?" → "Bem quente"
```
**Result:** Card com descrição completa incluindo todas as preferências

### Prazos
```
"Preciso disso até amanhã"
"Entregar na próxima segunda"
"Fazer isso hoje"
```
**Result:** Data de entrega automaticamente adicionada ao card

### Responsáveis
```
"João, você pode cuidar disso?"
"Maria ficará responsável"
```
**Result:** Nome do responsável na descrição

### Prioridades
```
"Isso é urgente"
"Baixa prioridade"
"Tarefa crítica"
```
**Result:** Prioridade identificada e marcada

## 🔧 Estrutura Técnica

### Manifest V3
- Service Worker para background tasks
- Chrome Storage API para API Keys
- TabCapture API para áudio da aba
- MediaDevices API para microfone

### APIs Utilizadas
- **OpenAI Whisper:** Transcrição de áudio
- **OpenAI GPT-4:** Extração e estruturação de tarefas
- **Trello REST API:** Criação de boards e cards

### Fluxo de Dados
```
Áudio (Mic + Tab) → MediaRecorder → Blob
    ↓
Whisper API → Transcrição (texto)
    ↓
GPT-4 API → JSON estruturado de tarefas
    ↓
Trello API → Cards criados
```

## 🐛 Troubleshooting

### "Permissão negada" no microfone
- Certifique-se de permitir acesso ao microfone quando solicitado
- Verifique as permissões em: `chrome://settings/content/microphone`

### "Erro na transcrição"
- Verifique se a API Key da OpenAI está correta
- Confirme se você tem créditos disponíveis na OpenAI
- Tamanho máximo do arquivo: 25MB

### Cards não aparecem no Trello
- Verifique se a API Key e Token estão corretos
- Confirme se o board "Task Recorder" foi criado
- Verifique se há pelo menos uma lista no board

### Áudio não é capturado da aba
- Certifique-se de que a aba está reproduzindo áudio
- Algumas páginas podem bloquear a captura de áudio
- Tente em uma videochamada (Meet, Zoom, Teams)

## 🚀 Próximas Features

- [ ] Opção de escolher entre OpenAI e Anthropic Claude
- [ ] Suporte a outros gerenciadores (Notion, Asana, Jira)
- [ ] Histórico de gravações
- [ ] Preview das tarefas antes de criar
- [ ] Edição manual de tarefas
- [ ] Exportar transcrição em TXT/PDF
- [ ] Suporte a múltiplos idiomas
- [ ] Tags automáticas por tipo de tarefa

## 📝 Notas Importantes

- **Privacidade:** Todo o áudio é processado via APIs externas (OpenAI)
- **Custos:** Uso da API OpenAI gera custos. Monitore seu uso em platform.openai.com
- **Limites:** 
  - Whisper: Arquivos até 25MB
  - GPT-4: Contexto de até ~8k tokens por requisição
  - Trello: Rate limit de 300 requests por 10 segundos

## 📄 Licença

MIT License - Use à vontade!

## 🤝 Contribuições

Sugestões e melhorias são bem-vindas! 

---

**Desenvolvido com ❤️ para facilitar a gestão de tarefas durante reuniões**