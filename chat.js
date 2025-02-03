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

// Add audio context and effects setup
let audioContext = null;
let audioDestination = null;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioDestination = audioContext.destination;
  }
}

// TTS State with localStorage support
const ttsState = {
  enabled: localStorage.getItem('ttsEnabled') === 'true' || true,
  users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]').map(([username, settings]) => {
    // Convert legacy format to new format with effects
    if (typeof settings === 'string') {
      return [username, { 
        voice: settings, 
        speed: 1, 
        pitch: 1,
        effects: {
          reverb: 0,
          chorus: 0,
          distortion: 0,
          echo: 0
        }
      }];
    }
    // Add effects if they don't exist
    if (!settings.effects) {
      settings.effects = {
        reverb: 0,
        chorus: 0,
        distortion: 0,
        echo: 0
      };
    }
    return [username, settings];
  })), 
  queue: [],
  speaking: false
};

// Initialize TTS
const tts = window.speechSynthesis;

// Break message into digestible chunks
function splitMessageIntoChunks(text, maxLength = 200) {
  // Skip if message contains URLs
  if (/https?:\/\/[^\s]+/.test(text)) {
    return [];
  }

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

// Add effect update functions
function updateUserEffect(username, effect, value) {
  if (ttsState.users.has(username)) {
    const settings = ttsState.users.get(username);
    settings.effects[effect] = parseFloat(value);
    ttsState.users.set(username, settings);
    saveTTSState();
  }
}

// Update the createAudioGraph function to handle effects
function createAudioGraph(utterance, userSettings) {
  initAudioContext();
  
  // Create media stream source
  const source = audioContext.createMediaStreamSource(utterance.audioStream);
  
  let currentNode = source;

  // Reverb
  if (userSettings.effects.reverb > 0) {
    const reverb = audioContext.createConvolver();
    const reverbTime = userSettings.effects.reverb * 3; // 0-3 seconds
    
    // Create impulse response
    const rate = audioContext.sampleRate;
    const length = rate * reverbTime;
    const impulse = audioContext.createBuffer(2, length, rate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, reverbTime);
      }
    }
    
    reverb.buffer = impulse;
    currentNode.connect(reverb);
    currentNode = reverb;
  }

  // Chorus
  if (userSettings.effects.chorus > 0) {
    const delay = audioContext.createDelay();
    const depth = userSettings.effects.chorus * 0.02; // 0-20ms
    delay.delayTime.value = depth;
    
    const chorus = audioContext.createGain();
    chorus.gain.value = 0.5;
    
    currentNode.connect(delay);
    delay.connect(chorus);
    currentNode.connect(chorus);
    currentNode = chorus;
  }

  // Distortion
  if (userSettings.effects.distortion > 0) {
    const distortion = audioContext.createWaveShaper();
    const amount = userSettings.effects.distortion * 400;
    
    function makeDistortionCurve(amount) {
      const samples = 44100;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; ++i) {
        const x = i * 2 / samples - 1;
        curve[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
      }
      return curve;
    }
    
    distortion.curve = makeDistortionCurve(amount);
    distortion.oversample = '4x';
    
    currentNode.connect(distortion);
    currentNode = distortion;
  }

  // Echo
  if (userSettings.effects.echo > 0) {
    const echo = audioContext.createDelay();
    const feedback = audioContext.createGain();
    const echoGain = audioContext.createGain();
    
    echo.delayTime.value = userSettings.effects.echo * 0.5; // 0-500ms
    feedback.gain.value = 0.4;
    echoGain.gain.value = 0.5;
    
    currentNode.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(echoGain);
    currentNode.connect(echoGain);
    currentNode = echoGain;
  }

  // Connect to destination
  currentNode.connect(audioDestination);
}

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
    ttsState.users.set(username, {
      voice: voiceName,
      speed: 1,
      pitch: 1,
      effects: {
        reverb: 0,
        chorus: 0,
        distortion: 0,
        echo: 0
      }
    });
    saveTTSState();
    updateTTSUsersList();
  }
}

function updateUserVoice(username, voiceName) {
  if (ttsState.users.has(username)) {
    const settings = ttsState.users.get(username);
    settings.voice = voiceName;
    ttsState.users.set(username, settings);
    saveTTSState();
    updateTTSUsersList();
  }
}

function updateUserSpeed(username, speed) {
  if (ttsState.users.has(username)) {
    const settings = ttsState.users.get(username);
    settings.speed = parseFloat(speed);
    ttsState.users.set(username, settings);
    saveTTSState();
  }
}

function updateUserPitch(username, pitch) {
  if (ttsState.users.has(username)) {
    const settings = ttsState.users.get(username);
    settings.pitch = parseFloat(pitch);
    ttsState.users.set(username, settings);
    saveTTSState();
  }
}

function removeTTSUser(username) {
  ttsState.users.delete(username);
  saveTTSState();
  updateTTSUsersList();
}

function updateTTSUsersList() {
  ttsUsersList.innerHTML = '';
  ttsState.users.forEach((settings, username) => {
    const div = document.createElement('div');
    div.className = 'tts-user';
    
    const voices = tts.getVoices();
    const voiceSelect = `
      <select onchange="updateUserVoice('${username}', this.value)">
        ${voices.map(voice => 
          `<option value="${voice.name}" ${voice.name === settings.voice ? 'selected' : ''}>
            ${voice.name} (${voice.lang})
          </option>`
        ).join('')}
      </select>
    `;

    const speedControl = `
      <div class="tts-control">
        <label>Speed:</label>
        <input type="range" 
               min="0.5" 
               max="2" 
               step="0.1" 
               value="${settings.speed}"
               onchange="updateUserSpeed('${username}', this.value)"
               oninput="this.nextElementSibling.textContent = this.value">
        <span>${settings.speed}</span>
      </div>
    `;

    const pitchControl = `
      <div class="tts-control">
        <label>Pitch:</label>
        <input type="range" 
               min="0.5" 
               max="2" 
               step="0.1" 
               value="${settings.pitch}"
               onchange="updateUserPitch('${username}', this.value)"
               oninput="this.nextElementSibling.textContent = this.value">
        <span>${settings.pitch}</span>
      </div>
    `;

    const createEffectControl = (name, effect) => `
      <div class="tts-control">
        <label>${name}:</label>
        <input type="range" 
               min="0" 
               max="1" 
               step="0.1" 
               value="${settings.effects[effect]}"
               onchange="updateUserEffect('${username}', '${effect}', this.value)"
               oninput="this.nextElementSibling.textContent = this.value">
        <span>${settings.effects[effect]}</span>
      </div>
    `;

    const effectControls = `
      <div class="effects-controls">
        ${createEffectControl('Reverb', 'reverb')}
        ${createEffectControl('Chorus', 'chorus')}
        ${createEffectControl('Distortion', 'distortion')}
        ${createEffectControl('Echo', 'echo')}
      </div>
    `;

    div.innerHTML = `
      <span>${username}</span>
      <div class="tts-settings">
        <div class="basic-settings">
          ${voiceSelect}
        </div>
        <button class="toggle-advanced" onclick="toggleAdvancedSettings(this)">Show Advanced Settings</button>
        <div class="advanced-settings">
          ${speedControl}
          ${pitchControl}
          ${effectControls}
        </div>
      </div>
      <button onclick="removeTTSUser('${username}')">×</button>
    `;
    ttsUsersList.appendChild(div);
  });
}

// Add this new function to handle toggling advanced settings
function toggleAdvancedSettings(button) {
  const advancedSettings = button.nextElementSibling;
  const isShowing = advancedSettings.classList.toggle('show');
  button.textContent = isShowing ? 'Hide Advanced Settings' : 'Show Advanced Settings';
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
  const userSettings = ttsState.users.get(username.toLowerCase());
  const voices = tts.getVoices();
  const voice = voices.find(v => v.name === userSettings.voice);

  chunks.forEach(chunk => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = userSettings.speed;
    utterance.pitch = userSettings.pitch;
    utterance.volume = 1;

    // Add audio processing when speaking starts
    utterance.onstart = (event) => {
      if (event.utterance.audioStream) {
        createAudioGraph(utterance, userSettings);
      }
    };

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