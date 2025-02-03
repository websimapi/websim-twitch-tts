// Store the TMI client globally
let client = null;

// Initialize elements
const channelInput = document.getElementById('channel-input');
const connectButton = document.getElementById('connect-btn');
const chatBox = document.getElementById('chat-box');
const statusDiv = document.getElementById('status');
const ttsToggleButton = document.getElementById('tts-toggle');
const ttsClearQueueButton = document.getElementById('tts-clear-queue');
const ttsAddForm = document.getElementById('tts-add-form');
const ttsUsernameInput = document.getElementById('tts-username');
const ttsVoiceSelect = document.getElementById('tts-voice-select');
const ttsUsersList = document.getElementById('tts-users');

// TTS State with localStorage support
const ttsState = {
  enabled: localStorage.getItem('ttsEnabled') === 'true' || true,
  users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]')), 
  queue: [],
  speaking: false
};

// Initialize TTS
const tts = window.speechSynthesis;

// Break message into digestible chunks
function splitMessageIntoChunks(text, maxLength = 200) {
  // First split on punctuation
  const punctuationSplit = text.split(/([.!?]+\s+)/g);
  const chunks = [];
  let currentChunk = '';

  punctuationSplit.forEach(segment => {
    if ((currentChunk + segment).length <= maxLength) {
      currentChunk += segment;
    } else {
      // If the current segment is too long, split on spaces
      if (currentChunk) chunks.push(currentChunk.trim());
      
      if (segment.length > maxLength) {
        // Split long segments on spaces
        const words = segment.split(/\s+/);
        currentChunk = '';
        
        words.forEach(word => {
          if ((currentChunk + ' ' + word).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
          }
        });
      } else {
        currentChunk = segment;
      }
    }
  });

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks.filter(chunk => chunk.length > 0);
}

// Reset TTS if it gets stuck
function resetTTS() {
  if (tts.speaking) {
    tts.cancel();
  }
  ttsState.speaking = false;
  processTTSQueue();
}

// Add automatic reset if TTS gets stuck
setInterval(() => {
  if (ttsState.speaking && !tts.speaking) {
    console.log("Detected stuck TTS state, resetting...");
    resetTTS();
  }
}, 1000);

// Populate voice select with available voices
function populateVoiceList() {
  const voices = tts.getVoices();
  ttsVoiceSelect.innerHTML = voices.map(voice => 
    `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`
  ).join('');
}

// Load TTS state from localStorage
function loadTTSState() {
  ttsToggleButton.textContent = ttsState.enabled ? 'TTS Enabled' : 'TTS Disabled';
  ttsToggleButton.classList.toggle('off', !ttsState.enabled);
  updateTTSUsersList();
}

// Save TTS state to localStorage
function saveTTSState() {
  localStorage.setItem('ttsEnabled', ttsState.enabled);
  localStorage.setItem('ttsUsers', JSON.stringify(Array.from(ttsState.users.entries())));
}

// Handle voice list change
tts.onvoiceschanged = () => {
  populateVoiceList();
  loadTTSState();
};

populateVoiceList();
loadTTSState();

// TTS Controls
ttsToggleButton.addEventListener('click', () => {
  ttsState.enabled = !ttsState.enabled;
  ttsToggleButton.textContent = ttsState.enabled ? 'TTS Enabled' : 'TTS Disabled';
  ttsToggleButton.classList.toggle('off', !ttsState.enabled);
  if (!ttsState.enabled) {
    clearTTSQueue();
  }
  saveTTSState();
});

ttsClearQueueButton.addEventListener('click', clearTTSQueue);

ttsAddForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = ttsUsernameInput.value.toLowerCase().trim();
  const voiceName = ttsVoiceSelect.value;
  if (username) {
    addTTSUser(username, voiceName);
    ttsUsernameInput.value = '';
  }
});

function addTTSUser(username, voiceName) {
  if (!ttsState.users.has(username)) {
    ttsState.users.set(username, voiceName);
    saveTTSState();
    updateTTSUsersList();
  }
}

function removeTTSUser(username) {
  ttsState.users.delete(username);
  saveTTSState();
  updateTTSUsersList();
}

function updateUserVoice(username, voiceName) {
  if (ttsState.users.has(username)) {
    ttsState.users.set(username, voiceName);
    saveTTSState();
  }
}

function updateTTSUsersList() {
  ttsUsersList.innerHTML = '';
  ttsState.users.forEach((voiceName, username) => {
    const div = document.createElement('div');
    div.className = 'tts-user';
    
    const voices = tts.getVoices();
    const voiceSelect = `
      <select onchange="updateUserVoice('${username}', this.value)">
        ${voices.map(voice => 
          `<option value="${voice.name}" ${voice.name === voiceName ? 'selected' : ''}>
            ${voice.name} (${voice.lang})
          </option>`
        ).join('')}
      </select>
    `;

    div.innerHTML = `
      <span>${username}</span>
      ${voiceSelect}
      <button onclick="removeTTSUser('${username}')">×</button>
    `;
    ttsUsersList.appendChild(div);
  });
}

function clearTTSQueue() {
  ttsState.queue = [];
  if (tts.speaking) {
    tts.cancel();
  }
  ttsState.speaking = false;
}

function queueTTSMessage(text, username) {
  if (!ttsState.enabled || !ttsState.users.has(username.toLowerCase()) || text.includes('!')) {
    return;
  }

  const chunks = splitMessageIntoChunks(text);
  const voiceName = ttsState.users.get(username.toLowerCase());
  const voices = tts.getVoices();
  const voice = voices.find(v => v.name === voiceName);

  chunks.forEach(chunk => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Add error handling
    utterance.onerror = (event) => {
      console.error('TTS Error:', event);
      resetTTS();
    };

    ttsState.queue.push(utterance);
  });

  processTTSQueue();
}

function processTTSQueue() {
  if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
    return;
  }

  ttsState.speaking = true;
  const utterance = ttsState.queue.shift();
  
  utterance.onend = () => {
    ttsState.speaking = false;
    processTTSQueue();
  };

  utterance.onerror = () => {
    console.error('TTS Error during playback');
    resetTTS();
  };

  try {
    tts.speak(utterance);
  } catch (error) {
    console.error('TTS Speak Error:', error);
    resetTTS();
  }
}

// Handle connect/disconnect
connectButton.addEventListener('click', () => {
  if (client && client.readyState() === 'OPEN') {
    disconnectFromChat();
  } else {
    connectToChat();
  }
});

function connectToChat() {
  const channel = channelInput.value.toLowerCase().trim();
  
  if (!channel) {
    alert('Please enter a channel name');
    return;
  }

  // Create new client
  client = new window.tmi.Client({
    connection: {
      secure: true,
      reconnect: true
    },
    channels: [channel]
  });

  // Handle connection
  client.connect().catch(console.error);

  // Setup event handlers
  client.on('connected', () => {
    statusDiv.className = 'status connected';
    statusDiv.textContent = `Connected to ${channel}'s chat`;
    connectButton.textContent = 'Disconnect';
  });

  client.on('disconnected', () => {
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = 'Disconnected from chat';
    connectButton.textContent = 'Connect';
  });

  client.on('message', (channel, tags, message, self) => {
    addChatMessage(tags['display-name'], message, tags);
    queueTTSMessage(message, tags['display-name']);
  });
}

function disconnectFromChat() {
  if (client) {
    client.disconnect();
    client = null;
  }
}

function addChatMessage(username, message, tags) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.setAttribute('data-username', username);

  // Add context menu event
  messageDiv.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, username);
  });

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timestampSpan = document.createElement('span');
  timestampSpan.className = 'timestamp';
  timestampSpan.textContent = timestamp;
  messageDiv.appendChild(timestampSpan);

  // Add username
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = username;
  messageDiv.appendChild(usernameSpan);

  // Add message
  const messageText = document.createElement('span');
  messageText.textContent = `: ${message}`;
  messageDiv.appendChild(messageText);

  // Add to chat box and scroll to bottom
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Limit messages to prevent memory issues
  while (chatBox.children.length > 500) {
    chatBox.removeChild(chatBox.firstChild);
  }
}

// Context Menu Functions
function showContextMenu(x, y, username) {
  // Remove any existing context menu
  removeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // Add TTS option
  const addTTSOption = document.createElement('div');
  addTTSOption.className = 'context-menu-item';
  addTTSOption.textContent = 'Add to TTS';
  addTTSOption.onclick = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      addTTSUser(username, voices[0].name);
    }
    removeContextMenu();
  };
  menu.appendChild(addTTSOption);

  document.body.appendChild(menu);

  // Close menu on click outside
  document.addEventListener('click', removeContextMenu);
}

function removeContextMenu() {
  const existingMenu = document.getElementById('context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  document.removeEventListener('click', removeContextMenu);
}

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});