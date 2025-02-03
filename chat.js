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
  speaking: false,
  maxQueueSize: 50, // Limit queue size to prevent memory issues
  lastResetTime: Date.now()
};

// Initialize TTS with error handling
const tts = window.speechSynthesis;
let ttsInitialized = false;

// Enhanced message splitting with better chunk handling
function splitMessageIntoChunks(text, maxLength = 150) {
  try {
    // Skip empty messages or those with just whitespace
    if (!text || !text.trim()) {
      return [];
    }

    // Skip if message contains URLs
    if (/https?:\/\/[^\s]+/.test(text)) {
      return [];
    }

    // Remove excessive whitespace and normalize
    text = text.replace(/\s+/g, ' ').trim();

    // Skip messages that are too long
    if (text.length > 1000) {
      console.warn('Message too long, skipping TTS');
      return [];
    }

    // First split on punctuation
    const punctuationSplit = text.split(/([.!?]+\s+)/g);
    const chunks = [];
    let currentChunk = '';

    punctuationSplit.forEach(segment => {
      // Skip empty segments
      if (!segment.trim()) return;

      if ((currentChunk + segment).length <= maxLength) {
        currentChunk += segment;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        
        // Handle long segments
        if (segment.length > maxLength) {
          // Split long segments on natural breaks
          const words = segment.split(/\s+/);
          currentChunk = '';
          
          words.forEach(word => {
            // Skip very long words
            if (word.length > maxLength) {
              console.warn('Skipping very long word:', word);
              return;
            }

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
    
    // Filter out empty chunks and limit total chunks
    return chunks
      .filter(chunk => chunk.length > 0)
      .slice(0, 10); // Limit to 10 chunks max
  } catch (error) {
    console.error('Error splitting message:', error);
    return [];
  }
}

// Enhanced TTS reset with timeout handling
function resetTTS() {
  const now = Date.now();
  const minResetInterval = 2000; // Minimum time between resets

  // Prevent rapid resets
  if (now - ttsState.lastResetTime < minResetInterval) {
    return;
  }

  try {
    if (tts.speaking) {
      tts.cancel();
    }
    ttsState.speaking = false;
    ttsState.lastResetTime = now;
    
    // Clear queue if it's gotten too large
    if (ttsState.queue.length > ttsState.maxQueueSize) {
      ttsState.queue = ttsState.queue.slice(0, 10); // Keep only the next 10 items
    }

    setTimeout(() => {
      processTTSQueue();
    }, 500);
  } catch (error) {
    console.error('Error resetting TTS:', error);
    ttsState.speaking = false;
    ttsState.queue = [];
  }
}

// Enhanced TTS monitoring
setInterval(() => {
  try {
    if (ttsState.speaking && !tts.speaking) {
      console.log("Detected stuck TTS state, resetting...");
      resetTTS();
    }

    // Check if TTS is available
    if (!ttsInitialized && tts.getVoices().length > 0) {
      ttsInitialized = true;
      populateVoiceList();
    }
  } catch (error) {
    console.error('Error in TTS monitor:', error);
  }
}, 1000);

// Enhanced voice population
function populateVoiceList() {
  try {
    const voices = tts.getVoices();
    if (!voices.length) {
      console.warn('No TTS voices available');
      return;
    }

    ttsVoiceSelect.innerHTML = voices
      .filter(voice => voice.name) // Ensure voice has a name
      .map(voice => 
        `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`
      ).join('');
  } catch (error) {
    console.error('Error populating voice list:', error);
  }
}

// Enhanced TTS message queueing
function queueTTSMessage(text, username) {
  try {
    if (!ttsState.enabled || 
        !ttsState.users.has(username.toLowerCase()) || 
        text.includes('!') ||
        ttsState.queue.length >= ttsState.maxQueueSize) {
      return;
    }

    const chunks = splitMessageIntoChunks(text);
    const voiceName = ttsState.users.get(username.toLowerCase());
    const voices = tts.getVoices();
    const voice = voices.find(v => v.name === voiceName);

    if (!voice) {
      console.warn(`Voice not found for user ${username}`);
      return;
    }

    chunks.forEach(chunk => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Add comprehensive error handling
      utterance.onerror = (event) => {
        console.error('TTS Error:', event);
        resetTTS();
      };

      utterance.onend = () => {
        // Mark chunk as completed
        utterance.completed = true;
      };

      // Add timeout to prevent stuck utterances
      utterance.timeout = setTimeout(() => {
        if (!utterance.completed) {
          console.warn('Utterance timeout - resetting TTS');
          resetTTS();
        }
      }, 10000); // 10 second timeout

      ttsState.queue.push(utterance);
    });

    processTTSQueue();
  } catch (error) {
    console.error('Error queueing TTS message:', error);
    resetTTS();
  }
}

// Enhanced queue processing
function processTTSQueue() {
  try {
    if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
      return;
    }

    ttsState.speaking = true;
    const utterance = ttsState.queue.shift();
    
    utterance.onend = () => {
      clearTimeout(utterance.timeout);
      ttsState.speaking = false;
      setTimeout(processTTSQueue, 100); // Small delay between utterances
    };

    utterance.onerror = (event) => {
      console.error('TTS Error during playback:', event);
      clearTimeout(utterance.timeout);
      resetTTS();
    };

    tts.speak(utterance);
  } catch (error) {
    console.error('Error processing TTS queue:', error);
    resetTTS();
  }
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
    updateTTSUsersList(); // This ensures the UI updates with the new voice
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

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timestampSpan = document.createElement('span');
  timestampSpan.className = 'timestamp';
  timestampSpan.textContent = timestamp;
  messageDiv.appendChild(timestampSpan);

  // Add username with click handler
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = username;
  
  // Only add click handler if user isn't already in TTS list
  if (!ttsState.users.has(username.toLowerCase())) {
    usernameSpan.classList.add('clickable');
    usernameSpan.title = 'Click to add TTS for this user';
    usernameSpan.addEventListener('click', () => {
      const voices = tts.getVoices();
      if (voices.length) {
        // Pick a random voice
        const randomVoice = voices[Math.floor(Math.random() * voices.length)].name;
        addTTSUser(username.toLowerCase(), randomVoice);
      }
    });
  }
  messageDiv.appendChild(usernameSpan);

  // Handle !gamblevoice command
  if (message.toLowerCase().startsWith('!gamblevoice') || message.toLowerCase().startsWith('!gv')) {
    if (ttsState.users.has(username.toLowerCase())) {
      const voices = tts.getVoices();
      const currentVoice = ttsState.users.get(username.toLowerCase());
      let newVoice;
      do {
        // Pick a random voice that's different from the current one
        newVoice = voices[Math.floor(Math.random() * voices.length)].name;
      } while (newVoice === currentVoice && voices.length > 1);
      
      updateUserVoice(username.toLowerCase(), newVoice);
      
      // Add a system message about the voice change
      const systemMessage = document.createElement('div');
      systemMessage.className = 'chat-message system-message';
      systemMessage.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="system-text"> ${username} rolled and got a new voice: ${newVoice}</span>
      `;
      chatBox.appendChild(systemMessage);
      chatBox.scrollTop = chatBox.scrollHeight;

      // Queue TTS notification about voice change
      queueTTSMessage(`${username} rolled for a new voice`, 'System');

      // If there's additional text after the command, read it with the new voice
      const additionalText = message.toLowerCase().startsWith('!gv') ? 
        message.slice(3).trim() : 
        message.slice(11).trim();
      if (additionalText) {
        queueTTSMessage(additionalText, username);
      }
    }
    return; // Don't process further if it was a command
  }

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

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});