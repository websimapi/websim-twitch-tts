// Store the TMI client globally
let client = null;

// Store bad words data
let badWordsData = [];

// Load bad words data
fetch('en.json')
  .then(response => response.json())
  .then(data => {
    badWordsData = data;
  })
  .catch(error => console.error('Error loading bad words data:', error));

// Check if text contains any bad words
function containsBadWords(text) {
  const lowerText = text.toLowerCase();
  return badWordsData.some(category => 
    category.dictionary.some(entry => {
      const matches = entry.match.split('|');
      return matches.some(match => lowerText.includes(match.toLowerCase()));
    })
  );
}

// Check if text contains any bad words and return censored version
function censorBadWords(text) {
  let censoredText = text;
  if (ttsState.filterEnabled) {
    badWordsData.forEach(category => {
      category.dictionary.forEach(entry => {
        const matches = entry.match.split('|');
        matches.forEach(match => {
          // Create a regex that matches the word with word boundaries
          const regex = new RegExp(`\\b${match}\\b`, 'gi');
          censoredText = censoredText.replace(regex, '*'.repeat(match.length));
        });
      });
    });
  }
  return censoredText;
}

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
const ttsFilterToggleButton = document.getElementById('tts-filter-toggle');
const soundUserSelect = document.getElementById('sound-user-select');
const soundUpload = document.getElementById('sound-upload');
const soundUploadBtn = document.getElementById('sound-upload-btn');
const soundList = document.getElementById('sound-list');

// TTS State with localStorage support
const ttsState = {
  enabled: localStorage.getItem('ttsEnabled') === 'true' || true,
  filterEnabled: localStorage.getItem('ttsFilterEnabled') === 'true' || true,
  users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]')), 
  queue: [],
  speaking: false,
  currentUtterance: null,
  userSounds: new Map()
};

// Load sounds from localStorage on startup
try {
  const savedSounds = JSON.parse(localStorage.getItem('userSounds') || '[]');
  savedSounds.forEach(([username, soundData]) => {
    // Create audio element from base64
    const audio = new Audio();
    audio.src = soundData.base64;
    ttsState.userSounds.set(username, {
      audio: audio,
      name: soundData.name,
      base64: soundData.base64
    });
  });
} catch (error) {
  console.error('Error loading saved sounds:', error);
}

// Initialize TTS
const tts = window.speechSynthesis;

// Split message into digestible chunks
function splitMessageIntoChunks(text, maxLength = 180) {
  // Skip if message contains URLs when filter is enabled
  if (ttsState.filterEnabled && /https?:\/\/[^\s]+/.test(text)) {
    return [];
  }

  // Censor bad words for display purposes
  const censoredText = censorBadWords(text);
  
  // If filter is enabled, we need to split on filtered words
  if (ttsState.filterEnabled) {
    const chunks = [];
    const words = text.split(/\s+/);
    let currentChunk = '';
    let currentDisplayChunk = '';
    
    words.forEach(word => {
      if (containsBadWords(word)) {
        // Add current chunk if it exists
        if (currentChunk) {
          chunks.push([currentChunk.trim(), currentDisplayChunk.trim()]);
        }
        // Add a special marker for sound effect
        chunks.push(['__SOUND_EFFECT__', '*'.repeat(word.length)]);
        currentChunk = '';
        currentDisplayChunk = '';
      } else {
        if ((currentChunk + ' ' + word).length <= maxLength) {
          currentChunk += (currentChunk ? ' ' : '') + word;
          currentDisplayChunk += (currentDisplayChunk ? ' ' : '') + word;
        } else {
          if (currentChunk) {
            chunks.push([currentChunk.trim(), currentDisplayChunk.trim()]);
          }
          currentChunk = word;
          currentDisplayChunk = word;
        }
      }
    });

    // Add remaining chunk if it exists
    if (currentChunk) {
      chunks.push([currentChunk.trim(), currentDisplayChunk.trim()]);
    }

    return chunks;
  } else {
    // Original sentence-based splitting logic for non-filtered text
    const punctuationSplit = text.split(/([.!?]+\s+)/g);
    const chunks = [];
    let currentChunk = '';

    punctuationSplit.forEach(segment => {
      if ((currentChunk + segment).length <= maxLength) {
        currentChunk += segment;
      } else {
        if (currentChunk) chunks.push([currentChunk.trim(), currentChunk.trim()]);
        
        if (segment.length > maxLength) {
          // Split long segments on spaces
          const words = segment.split(/\s+/);
          currentChunk = '';
          
          words.forEach(word => {
            if ((currentChunk + ' ' + word).length <= maxLength) {
              currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
              if (currentChunk) chunks.push([currentChunk.trim(), currentChunk.trim()]);
              currentChunk = word;
            }
          });
        } else {
          currentChunk = segment;
        }
      }
    });

    if (currentChunk) chunks.push([currentChunk.trim(), currentChunk.trim()]);
    return chunks.filter(chunk => chunk[0].length > 0);
  }
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
  ttsFilterToggleButton.textContent = ttsState.filterEnabled ? 'Filter Enabled' : 'Filter Disabled';
  ttsFilterToggleButton.classList.toggle('off', !ttsState.filterEnabled);
  updateTTSUsersList();
}

// Save TTS state to localStorage
function saveTTSState() {
  localStorage.setItem('ttsEnabled', ttsState.enabled);
  localStorage.setItem('ttsFilterEnabled', ttsState.filterEnabled);
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

// Add filter toggle handler
ttsFilterToggleButton.addEventListener('click', () => {
  ttsState.filterEnabled = !ttsState.filterEnabled;
  ttsFilterToggleButton.textContent = ttsState.filterEnabled ? 'Filter Enabled' : 'Filter Disabled';
  ttsFilterToggleButton.classList.toggle('off', !ttsState.filterEnabled);
  saveTTSState();
});

function addTTSUser(username, voiceName) {
  if (!ttsState.users.has(username)) {
    ttsState.users.set(username, voiceName);
    saveTTSState();
    updateTTSUsersList();
    updateSoundUserSelect();
  }
}

function removeTTSUser(username) {
  ttsState.users.delete(username);
  deleteUserSound(username);
  saveTTSState();
  updateTTSUsersList();
  updateSoundUserSelect();
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
  updateQueueDisplay();
}

function updateQueueDisplay() {
  const queueDisplay = document.getElementById('tts-queue-display');
  const currentDisplay = document.getElementById('tts-current-display');
  
  // Update Currently Reading section
  if (ttsState.speaking && ttsState.currentUtterance) {
    currentDisplay.innerHTML = `
      <div class="current-item">
        <span class="current-icon">🔊</span>
        <span class="current-text">${ttsState.currentUtterance.displayText}</span>
        <span class="current-username">${ttsState.currentUtterance.username}</span>
      </div>
    `;
  } else {
    currentDisplay.innerHTML = '<div class="empty-current">Nothing currently playing</div>';
  }

  // Update Queue section
  if (ttsState.queue.length === 0) {
    queueDisplay.innerHTML = '<div class="empty-queue">Queue is empty</div>';
    return;
  }

  queueDisplay.innerHTML = ttsState.queue.map((utterance, index) => `
    <div class="queue-item">
      <span class="queue-number">${index + 1}.</span>
      <span class="queue-username">${utterance.username}</span>
      <span class="queue-text">${utterance.displayText}</span>
    </div>
  `).join('');
}

function queueTTSMessage(text, username) {
  if (!ttsState.enabled || !ttsState.users.has(username.toLowerCase()) || text.startsWith('!')) {
    return;
  }

  const chunks = splitMessageIntoChunks(text);
  const voiceName = ttsState.users.get(username.toLowerCase());
  const voices = tts.getVoices();
  const voice = voices.find(v => v.name === voiceName);

  chunks.forEach(([ttsText, displayText]) => {
    if (ttsText === '__SOUND_EFFECT__') {
      // Create a special utterance for sound effects
      const utterance = new SpeechSynthesisUtterance('');
      utterance.text = '__SOUND_EFFECT__';
      utterance.username = username;
      utterance.displayText = displayText;
      ttsState.queue.push(utterance);
    } else {
      const utterance = new SpeechSynthesisUtterance(ttsText);
      
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.username = username;
      utterance.displayText = displayText;

      utterance.onerror = (event) => {
        console.error('TTS Error:', event);
        resetTTS();
      };

      ttsState.queue.push(utterance);
    }
  });

  updateQueueDisplay();
  processTTSQueue();
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
  messageText.textContent = `: ${censorBadWords(message)}`;
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

// Update sound user select when TTS users change
function updateSoundUserSelect() {
  soundUserSelect.innerHTML = Array.from(ttsState.users.keys()).map(username => 
    `<option value="${username}">${username}</option>`
  ).join('');
}

// Update sound list display
function updateSoundList() {
  soundList.innerHTML = '';
  ttsState.userSounds.forEach((soundData, username) => {
    const div = document.createElement('div');
    div.className = 'sound-item';
    div.innerHTML = `
      <span>${username}</span>
      <span>${soundData.name}</span>
      <button class="play-btn" onclick="playUserSound('${username}')">Test</button>
      <button class="delete-btn" onclick="deleteUserSound('${username}')">Delete</button>
    `;
    soundList.appendChild(div);
  });
}

// Play user's custom sound and return a promise
function playUserSound(username) {
  return new Promise((resolve, reject) => {
    const soundData = ttsState.userSounds.get(username);
    if (soundData && soundData.audio) {
      // Clone the audio to allow multiple simultaneous plays
      const audioClone = soundData.audio.cloneNode();
      audioClone.onended = () => resolve();
      audioClone.onerror = () => reject();
      audioClone.play().catch(reject);
    } else {
      resolve(); // No sound to play, resolve immediately
    }
  });
}

// Delete user's custom sound
function deleteUserSound(username) {
  if (ttsState.userSounds.has(username)) {
    ttsState.userSounds.delete(username);
    saveUserSounds();
    updateSoundList();
  }
}

// Save user sounds to localStorage
function saveUserSounds() {
  const serializedSounds = Array.from(ttsState.userSounds.entries()).map(([username, soundData]) => [
    username,
    {
      name: soundData.name,
      base64: soundData.base64
    }
  ]);
  localStorage.setItem('userSounds', JSON.stringify(serializedSounds));
}

// Handle sound upload
soundUploadBtn.addEventListener('click', () => {
  const username = soundUserSelect.value;
  const file = soundUpload.files[0];
  
  if (!username || !file) {
    alert('Please select a user and sound file');
    return;
  }

  if (!file.type.startsWith('audio/')) {
    alert('Please select an audio file');
    return;
  }

  // Convert file to base64
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result;
    
    // Create and test audio element
    const audio = new Audio();
    audio.src = base64Data;
    
    // Store the sound data
    ttsState.userSounds.set(username, {
      audio: audio,
      name: file.name,
      base64: base64Data
    });

    saveUserSounds();
    updateSoundList();
    soundUpload.value = '';
  };
  
  reader.readAsDataURL(file);
});

// Initialize sound management
updateSoundUserSelect();
updateSoundList();

// Convert TTS speak to promise
function speakText(utterance) {
  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Resolve on error too, to keep queue moving
    try {
      tts.speak(utterance);
    } catch (error) {
      console.error('TTS Speak Error:', error);
      resolve();
    }
  });
}

// Make processTTSQueue async
async function processTTSQueue() {
  if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
    updateQueueDisplay();
    return;
  }

  ttsState.speaking = true;
  const utterance = ttsState.queue.shift();
  ttsState.currentUtterance = utterance;
  updateQueueDisplay();

  // Check if this is a sound effect marker
  if (utterance.text === '__SOUND_EFFECT__') {
    if (ttsState.userSounds.has(utterance.username.toLowerCase())) {
      try {
        await playUserSound(utterance.username.toLowerCase());
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    }
    ttsState.speaking = false;
    ttsState.currentUtterance = null;
    processTTSQueue(); // Continue to next item
    return;
  }

  try {
    await speakText(utterance);
  } catch (error) {
    console.error('TTS Error during playback:', error);
  }
  
  ttsState.speaking = false;
  ttsState.currentUtterance = null;
  processTTSQueue();
}