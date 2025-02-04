// Store the TMI client globally
let client = null;

// Store bad words data
let badWordsData = [];

// Mute feature: store muted users (usernames in lowercase) in a Set loaded from localStorage
let mutedUsers = new Set(JSON.parse(localStorage.getItem('mutedUsers') || '[]'));

// Auto Add User setting: if enabled, automatically create a TTS user when not already set up
let autoAddUserEnabled = localStorage.getItem('autoAddUserEnabled');
autoAddUserEnabled = autoAddUserEnabled === null ? true : autoAddUserEnabled === 'true';

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
const autoAddUserToggle = document.getElementById('auto-add-user-toggle');
const customCommandsBtn = document.getElementById('custom-commands-btn');

// TTS State with localStorage support
const ttsState = {
  enabled: localStorage.getItem('ttsEnabled') === 'false' ? false : true,
  filterEnabled: localStorage.getItem('ttsFilterEnabled') === 'false' ? false : true,
  users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]')), 
  queue: [],
  speaking: false,
  currentUtterance: null
};

// Initialize TTS
const tts = window.speechSynthesis;

// Variable for Gamble Settings
const defaultGambleTriggers = ["!gamblevoice", "!gv", "bonesd3TC"];
const gambleState = {
  cooldown: parseInt(localStorage.getItem('gambleCooldown')) || 0,
  enabled: localStorage.getItem('gambleEnabled') === 'false' ? false : true,
  lastUse: new Map()
};
// Load gamble triggers from localStorage or use default triggers
let gambleTriggers = JSON.parse(localStorage.getItem('gambleTriggers') || JSON.stringify(defaultGambleTriggers));

// Function to extract title and author from URL (mock implementation)
async function getMediaInfo(url) {
  // This would need to be implemented with proper API calls
  // For now, return null to indicate no info available
  return null;
}

// Function to check if URL is from supported music service
function isMusicServiceUrl(url) {
  return url.match(/youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i);
}

// Function to create clickable link element with metadata placeholder
function createLinkElement(url, metadata) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.textContent = url;
  link.style.color = '#6441A4';
  link.style.textDecoration = 'none';
  
  const container = document.createElement('span');
  container.appendChild(link);
  
  if (metadata) {
    const metadataSpan = document.createElement('span');
    metadataSpan.textContent = ` (${metadata})`;
    metadataSpan.style.color = '#666';
    container.appendChild(metadataSpan);
  }
  
  return container;
}

// Split message into digestible chunks
function splitMessageIntoChunks(text, maxLength = 180) {
  // Skip if message contains URLs
  if (/https?:\/\/[^\s]+/.test(text)) {
    // Extract non-URL parts for TTS
    const parts = text.split(/https?:\/\/[^\s]+/);
    const nonUrlText = parts.join(' ').trim();
    return nonUrlText ? splitMessageIntoChunks(nonUrlText) : [];
  }

  // Censor bad words for display purposes
  const censoredText = censorBadWords(text);
  
  // Replace bad words with spaces for TTS when filter is enabled
  let ttsText = text;
  if (ttsState.filterEnabled) {
    badWordsData.forEach(category => {
      category.dictionary.forEach(entry => {
        const matches = entry.match.split('|');
        matches.forEach(match => {
          const regex = new RegExp(`\\b${match}\\b`, 'gi');
          ttsText = ttsText.replace(regex, ' ');
        });
      });
    });
  }

  // First split on punctuation
  const punctuationSplit = ttsText.split(/([.!?]+\s+)/g);
  const chunks = [];
  let currentChunk = '';

  punctuationSplit.forEach(segment => {
    if ((currentChunk + segment).length <= maxLength) {
      currentChunk += segment;
    } else {
      if (currentChunk) chunks.push([currentChunk.trim(), censorBadWords(currentChunk.trim())]);
      
      if (segment.length > maxLength) {
        // Split long segments on spaces
        const words = segment.split(/\s+/);
        currentChunk = '';
        
        words.forEach(word => {
          if ((currentChunk + ' ' + word).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) chunks.push([currentChunk.trim(), censorBadWords(currentChunk.trim())]);
            currentChunk = word;
          }
        });
      } else {
        currentChunk = segment;
      }
    }
  });

  if (currentChunk) chunks.push([currentChunk.trim(), censorBadWords(currentChunk.trim())]);
  return chunks.filter(chunk => chunk[0].length > 0);
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
  // Update auto add user toggle UI
  autoAddUserToggle.textContent = autoAddUserEnabled ? 'Auto Add User: On' : 'Auto Add User: Off';
}

// Save TTS state to localStorage
function saveTTSState() {
  localStorage.setItem('ttsEnabled', ttsState.enabled);
  localStorage.setItem('ttsFilterEnabled', ttsState.filterEnabled);
  localStorage.setItem('ttsUsers', JSON.stringify(Array.from(ttsState.users.entries())));
}

// Save muted users state to localStorage
function saveMutedUsers() {
  localStorage.setItem('mutedUsers', JSON.stringify(Array.from(mutedUsers)));
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

// Auto Add User Toggle Handler
autoAddUserToggle.addEventListener('click', () => {
  autoAddUserEnabled = !autoAddUserEnabled;
  localStorage.setItem('autoAddUserEnabled', autoAddUserEnabled);
  autoAddUserToggle.textContent = autoAddUserEnabled ? 'Auto Add User: On' : 'Auto Add User: Off';
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
    updateTTSUsersList();
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
    
    // Determine mute button text based on whether the user is muted
    const isMuted = mutedUsers.has(username);
    const muteButton = `<button onclick="toggleMuteUser('${username}')" class="control-btn ${isMuted ? 'toggle-btn off' : 'toggle-btn'}">${isMuted ? 'Unmute' : 'Mute'}</button>`;

    div.innerHTML = `
      <span>${username}</span>
      ${voiceSelect}
      ${muteButton}
      <button onclick="removeTTSUser('${username}')">×</button>
    `;
    ttsUsersList.appendChild(div);
  });
}

// Global function to toggle mute state for a user
function toggleMuteUser(username) {
  username = username.toLowerCase();
  if (mutedUsers.has(username)) {
    mutedUsers.delete(username);
  } else {
    mutedUsers.add(username);
  }
  saveMutedUsers();
  updateTTSUsersList();
}
window.toggleMuteUser = toggleMuteUser; // Expose to global scope for inline events

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
  
  // Update Last Read section
  if (ttsState.currentUtterance) {
    currentDisplay.innerHTML = `
      <div class="current-item">
        <span class="current-icon">🔊</span>
        <span class="current-text">${ttsState.currentUtterance.displayText}</span>
        <span class="current-username">${ttsState.currentUtterance.username}</span>
      </div>
    `;
  } else {
    currentDisplay.innerHTML = '<div class="empty-current">Nothing read yet</div>';
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

// Modify queueTTSMessage to skip messages that start with a command trigger.
// Also, if the user is muted, their messages are not queued.
function queueTTSMessage(text, username) {
  username = username.toLowerCase();
  // Skip TTS if user is muted
  if (mutedUsers.has(username)) return;
  
  const lowerText = text.toLowerCase();
  if (gambleTriggers.some(trigger => lowerText.startsWith(trigger.toLowerCase()))) {
    // Do not enqueue TTS if the message starts with any valid gamble command trigger.
    return;
  }
  // Only ignore messages starting with "!" if at the very start (commands), but not elsewhere in the text.
  if (text[0] === '!' && !gambleTriggers.some(trigger => lowerText.startsWith(trigger.toLowerCase()))) {
    return;
  }
  
  if (!ttsState.enabled || !ttsState.users.has(username)) {
    return;
  }

  const chunks = splitMessageIntoChunks(text);
  const voiceName = ttsState.users.get(username);
  const voices = tts.getVoices();
  const voice = voices.find(v => v.name === voiceName);

  chunks.forEach(([ttsText, displayText]) => {
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
    updateQueueDisplay();
  });

  processTTSQueue();
}

function processTTSQueue() {
  if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
    updateQueueDisplay();
    return;
  }

  ttsState.speaking = true;
  const utterance = ttsState.queue.shift();
  ttsState.currentUtterance = utterance;
  updateQueueDisplay();
  
  utterance.onstart = () => {
    updateQueueDisplay();
  };

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

// Custom Commands Helper Functions
// The functions getCustomCommand, queueCustomTTSMessage, and playCustomAudio are used by custom commands feature.
// getCustomCommand(trigger) is defined in customCommands.js and attached to window.
// Here we define:
function queueCustomTTSMessage(text, voiceName, username) {
  const chunks = splitMessageIntoChunks(text);
  const voices = tts.getVoices();
  const voice = voices.find(v => v.name === voiceName);
  chunks.forEach(([ttsText, displayText]) => {
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
    updateQueueDisplay();
  });
  processTTSQueue();
}

function playCustomAudio(audioData) {
  const audio = new Audio(audioData);
  audio.play().catch(error => console.error('Audio Playback Error:', error));
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
    const username = tags['display-name'] || 'Anonymous';
    const lowerMessage = message.trim().toLowerCase();
    // Check for custom command
    if (window.getCustomCommand) {
      const customCmd = window.getCustomCommand(lowerMessage);
      if (customCmd) {
        addChatMessage(username, message, tags);
        if (customCmd.type === "tts") {
          queueCustomTTSMessage(customCmd.message, customCmd.voice, username);
        } else if (customCmd.type === "audio") {
          playCustomAudio(customCmd.audioData);
        }
        return;
      }
    }
    addChatMessage(username, message, tags);
    queueTTSMessage(message, username);
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
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  messageDiv.appendChild(timestamp);

  // Add username with click handler or auto-creation if enabled
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = username;
  
  // If the user is not set up for TTS
  if (!ttsState.users.has(username.toLowerCase())) {
    if (autoAddUserEnabled) {
      const voices = tts.getVoices();
      if (voices.length) {
        const randomVoice = voices[Math.floor(Math.random() * voices.length)].name;
        addTTSUser(username.toLowerCase(), randomVoice);
      }
    } else {
      usernameSpan.classList.add('clickable');
      usernameSpan.title = 'Click to add TTS for this user';
      usernameSpan.addEventListener('click', () => {
        const voices = tts.getVoices();
        if (voices.length) {
          const randomVoice = voices[Math.floor(Math.random() * voices.length)].name;
          addTTSUser(username.toLowerCase(), randomVoice);
        }
      });
    }
  }
  messageDiv.appendChild(usernameSpan);

  // Check for gamble command triggers using gambleTriggers array
  if (gambleTriggers.some(trigger => message.toLowerCase().startsWith(trigger.toLowerCase()))) {
    if (!gambleState.enabled) {
      const disabledMessage = document.createElement('div');
      disabledMessage.className = 'chat-message system-message';
      disabledMessage.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="system-text">Gamble Voice command is currently disabled</span>
      `;
      chatBox.appendChild(disabledMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
      
      // Queue TTS message about disabled state
      queueTTSMessage("Gamble Voice command is currently disabled", "System");
      return;
    }

    if (ttsState.users.has(username.toLowerCase())) {
      if (isOnGambleCooldown(username.toLowerCase())) {
        const cooldownMessage = document.createElement('div');
        cooldownMessage.className = 'chat-message system-message';
        const remainingTime = Math.ceil((gambleState.cooldown * 1000 - (Date.now() - gambleState.lastUse.get(username.toLowerCase()))) / 1000);
        cooldownMessage.innerHTML = `
          <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          <span class="system-text">${username} must wait ${remainingTime} seconds before using gamble voice again</span>
        `;
        chatBox.appendChild(cooldownMessage);
        chatBox.scrollTop = chatBox.scrollHeight;
        return;
      }

      const voices = tts.getVoices();
      const currentVoice = ttsState.users.get(username.toLowerCase());
      let newVoice;
      do {
        newVoice = voices[Math.floor(Math.random() * voices.length)].name;
      } while (newVoice === currentVoice && voices.length > 1);
      
      updateUserVoice(username.toLowerCase(), newVoice);
      
      // Update last use time
      gambleState.lastUse.set(username.toLowerCase(), Date.now());
      
      // Add a system message about the voice change
      const systemMessage = document.createElement('div');
      systemMessage.className = 'chat-message system-message';
      systemMessage.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="system-text">${username} rolled and got a new voice: ${newVoice}</span>
      `;
      chatBox.appendChild(systemMessage);
      chatBox.scrollTop = chatBox.scrollHeight;

      // Queue TTS notification about voice change
      queueTTSMessage(`${username} rolled for a new voice`, 'System');

      // If there's additional text after the command trigger, read it with the new voice
      const triggerMatched = gambleTriggers.find(trigger => message.toLowerCase().startsWith(trigger.toLowerCase()));
      const additionalText = message.slice(triggerMatched.length).trim();
      if (additionalText) {
        queueTTSMessage(additionalText, username);
      }
    }
    return; // Do not process further if message is a gamble command
  }

  // Add colon after username
  const colonSpan = document.createElement('span');
  colonSpan.textContent = ': ';
  messageDiv.appendChild(colonSpan);

  // Process message content
  const messageContent = document.createElement('span');
  let remainingText = message;
  
  // Find URLs in message
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urlMatches = [...message.matchAll(urlRegex)];
  
  if (urlMatches.length > 0) {
    let lastIndex = 0;
    
    for (const match of urlMatches) {
      const url = match[0];
      const beforeText = message.substring(lastIndex, match.index);
      
      if (beforeText) {
        const textNode = document.createTextNode(censorBadWords(beforeText));
        messageContent.appendChild(textNode);
      }
      
      if (isMusicServiceUrl(url)) {
        const linkElement = createLinkElement(url, ''); // Initially empty metadata
        messageContent.appendChild(linkElement);
        
        // Fetch and update metadata asynchronously
        getMediaInfo(url).then(metadata => {
          if (metadata) {
            linkElement.lastChild.textContent = ` (${metadata})`;
          }
        });
      } else {
        const textNode = document.createTextNode(url);
        messageContent.appendChild(textNode);
      }
      
      lastIndex = match.index + url.length;
    }
    
    // Add any remaining text after the last URL
    const afterText = message.substring(lastIndex);
    if (afterText) {
      const textNode = document.createTextNode(censorBadWords(afterText));
      messageContent.appendChild(textNode);
    }
  } else {
    messageContent.textContent = censorBadWords(message);
  }
  
  messageDiv.appendChild(messageContent);

  // Add to chat box and scroll to bottom
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Limit messages
  while (chatBox.children.length > 500) {
    chatBox.removeChild(chatBox.firstChild);
  }
}

// Check if a user is on gamble cooldown
function isOnGambleCooldown(username) {
  if (gambleState.cooldown === 0) return false;
  
  const lastUse = gambleState.lastUse.get(username);
  if (!lastUse) return false;
  
  const timeSinceLastUse = Date.now() - lastUse;
  return timeSinceLastUse < (gambleState.cooldown * 1000);
}

// Gamble Settings Modal Controls
const gambleSettingsBtn = document.getElementById('gamble-settings-btn');
const gambleSettingsModal = document.getElementById('gamble-settings-modal');
const gambleCooldownInput = document.getElementById('gamble-cooldown');
const gambleEnabledCheckbox = document.getElementById('gamble-enabled');
const gambleTriggersInput = document.getElementById('gamble-triggers');
const saveGambleSettingsBtn = document.getElementById('save-gamble-settings');
const restoreGambleDefaultsBtn = document.getElementById('restore-gamble-defaults');

gambleCooldownInput.value = gambleState.cooldown;
gambleEnabledCheckbox.checked = gambleState.enabled;
gambleTriggersInput.value = gambleTriggers.join(', ');

gambleSettingsBtn.addEventListener('click', () => {
  gambleSettingsModal.style.display = 'block';
});

window.addEventListener('click', (e) => {
  if (e.target === gambleSettingsModal) {
    gambleSettingsModal.style.display = 'none';
  }
});

saveGambleSettingsBtn.addEventListener('click', () => {
  gambleState.cooldown = parseInt(gambleCooldownInput.value) || 0;
  gambleState.enabled = gambleEnabledCheckbox.checked;
  // Update gambleTriggers based on comma separated values entered. Trim spaces.
  gambleTriggers = gambleTriggersInput.value.split(',').map(trigger => trigger.trim()).filter(trigger => trigger);
  localStorage.setItem('gambleCooldown', gambleState.cooldown);
  localStorage.setItem('gambleEnabled', gambleState.enabled);
  localStorage.setItem('gambleTriggers', JSON.stringify(gambleTriggers));
  gambleSettingsModal.style.display = 'none';
});

restoreGambleDefaultsBtn.addEventListener('click', () => {
  gambleTriggers = [...defaultGambleTriggers];
  gambleTriggersInput.value = gambleTriggers.join(', ');
  localStorage.setItem('gambleTriggers', JSON.stringify(gambleTriggers));
});

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});

// Event listener to open Custom Commands modal
customCommandsBtn.addEventListener('click', () => {
  const customModal = document.getElementById('custom-commands-modal');
  customModal.style.display = 'block';
});

// Clicking the close button on Custom Commands modal
document.getElementById('close-custom-commands').addEventListener('click', () => {
  document.getElementById('custom-commands-modal').style.display = 'none';
});

// Clicking outside the Custom Commands modal closes it
window.addEventListener('click', (e) => {
  const customModal = document.getElementById('custom-commands-modal');
  if (e.target === customModal) {
    customModal.style.display = 'none';
  }
});