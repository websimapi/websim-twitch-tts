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

// TTS State with localStorage support
const ttsState = {
  enabled: localStorage.getItem('ttsEnabled') === 'true' || true,
  filterEnabled: localStorage.getItem('ttsFilterEnabled') === 'true' || true,
  users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]')), 
  queue: [],
  speaking: false,
  currentUtterance: null
};

// Media Queue State
const mediaQueueState = {
  enabled: localStorage.getItem('mediaQueueEnabled') === 'true' || false,
  queue: [],
  currentlyPlaying: null
};

// Initialize TTS
const tts = window.speechSynthesis;

// Function to extract title and author from URL (mock implementation)
async function getMediaInfo(url) {
  // TODO: Implement actual API calls to get media info
  // Mock implementation for now
  const mockData = {
    'youtube.com': { author: 'Sample Artist', title: 'Sample YouTube Song' },
    'youtu.be': { author: 'Sample Artist', title: 'Sample YouTube Song' },
    'spotify.com': { author: 'Sample Artist', title: 'Sample Spotify Track' },
    'soundcloud.com': { author: 'Sample Artist', title: 'Sample SoundCloud Track' }
  };
  
  const domain = new URL(url).hostname.replace('www.', '');
  const service = Object.keys(mockData).find(key => domain.includes(key));
  
  if (service) {
    return mockData[service];
  }
  return null;
}

// Function to check if URL is from supported music service
function isMusicServiceUrl(url) {
  return url.match(/youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i);
}

// Function to create clickable link element
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
  
  // Replace bad words with spaces for TTS
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
}

// Save TTS state to localStorage
function saveTTSState() {
  localStorage.setItem('ttsEnabled', ttsState.enabled);
  localStorage.setItem('ttsFilterEnabled', ttsState.filterEnabled);
  localStorage.setItem('ttsUsers', JSON.stringify(Array.from(ttsState.users.entries())));
}

// Load media queue state from localStorage
function loadMediaQueueState() {
  const mediaQueueToggleButton = document.getElementById('media-queue-toggle');
  mediaQueueToggleButton.textContent = mediaQueueState.enabled ? 'Media Queue Enabled' : 'Media Queue Disabled';
  mediaQueueToggleButton.classList.toggle('off', !mediaQueueState.enabled);
  updateMediaQueueDisplay();
}

// Save media queue state to localStorage
function saveMediaQueueState() {
  localStorage.setItem('mediaQueueEnabled', mediaQueueState.enabled);
}

// Handle voice list change
tts.onvoiceschanged = () => {
  populateVoiceList();
  loadTTSState();
};

// Initialize buttons
const mediaQueueToggleButton = document.getElementById('media-queue-toggle');

populateVoiceList();
loadTTSState();
loadMediaQueueState();

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

// Media queue toggle handler
mediaQueueToggleButton.addEventListener('click', () => {
  mediaQueueState.enabled = !mediaQueueState.enabled;
  mediaQueueToggleButton.textContent = mediaQueueState.enabled ? 'Media Queue Enabled' : 'Media Queue Disabled';
  mediaQueueToggleButton.classList.toggle('off', !mediaQueueState.enabled);
  saveMediaQueueState();
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
    const utterance = new SpeechSynthesisUtterance(ttsText);
    
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.username = username;
    utterance.displayText = displayText; // Store censored version for display

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
  
  utterance.onend = () => {
    ttsState.speaking = false;
    ttsState.currentUtterance = null;
    processTTSQueue();
  };

  utterance.onstart = () => {
    updateQueueDisplay(); // Update display when speech starts
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

// Function to create iframe based on URL
function createMediaEmbed(url) {
  const urlObj = new URL(url);
  let embedUrl;
  let iframe = document.createElement('iframe');
  
  // Set common iframe properties
  iframe.style.width = '100%';
  iframe.style.height = '315px'; 
  iframe.style.border = 'none';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;

  // YouTube handling
  if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
    let videoId;
    if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1);
    } else {
      videoId = urlObj.searchParams.get('v');
    }
    
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&playsinline=1&enablejsapi=1`;
    
    // Add YouTube API support
    iframe.setAttribute('id', `youtube-${videoId}`);
    iframe.onload = () => {
      new YT.Player(`youtube-${videoId}`, {
        events: {
          'onStateChange': (event) => {
            if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.UNSTARTED) {
              mediaQueueState.currentlyPlaying = null;
              mediaQueueState.queue.shift();
              updateMediaQueueDisplay();
              processMediaQueue();
            }
          }
        }
      });
    };
  } 
  // Spotify handling
  else if (urlObj.hostname.includes('spotify.com')) {
    const parts = urlObj.pathname.split('/');
    const typeIndex = parts.indexOf('track') || parts.indexOf('playlist') || parts.indexOf('album');
    if (typeIndex !== -1) {
      const id = parts[typeIndex + 1];
      const type = parts[typeIndex];
      embedUrl = `https://open.spotify.com/embed/${type}/${id}?autoplay=1`;
      
      // Add event listener for Spotify playback end
      iframe.onload = () => {
        setTimeout(() => {
          if (mediaQueueState.currentlyPlaying) {
            mediaQueueState.currentlyPlaying = null;
            mediaQueueState.queue.shift();
            updateMediaQueueDisplay();
            processMediaQueue();
          }
        }, 5000); // Check after 5 seconds if player loaded
      };
    }
  } 
  // SoundCloud handling
  else if (urlObj.hostname.includes('soundcloud.com')) {
    embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`;
    
    // Add SoundCloud API support
    iframe.onload = () => {
      const widget = SC.Widget(iframe);
      widget.bind(SC.Widget.Events.FINISH, () => {
        mediaQueueState.currentlyPlaying = null;
        mediaQueueState.queue.shift();
        updateMediaQueueDisplay();
        processMediaQueue();
      });
    };
  }

  if (embedUrl) {
    iframe.src = embedUrl;
    return iframe;
  }
  return null;
}

// Function to process media queue
function processMediaQueue() {
  const mediaPlayer = document.getElementById('media-player');
  if (!mediaQueueState.enabled || mediaQueueState.currentlyPlaying || mediaQueueState.queue.length === 0) {
    mediaPlayer.innerHTML = ''; // Clear player if nothing to play
    return;
  }

  const nextItem = mediaQueueState.queue[0];
  const embed = createMediaEmbed(nextItem.url);
  
  if (embed) {
    mediaQueueState.currentlyPlaying = nextItem;
    mediaPlayer.innerHTML = '';
    mediaPlayer.appendChild(embed);
    
    // Add manual skip button with improved skip functionality
    const skipButton = document.createElement('button');
    skipButton.textContent = 'Skip';
    skipButton.className = 'control-btn';
    skipButton.onclick = () => {
      mediaQueueState.currentlyPlaying = null;
      mediaQueueState.queue.shift();
      updateMediaQueueDisplay();
      
      // Force immediate processing of next item
      setTimeout(() => {
        processMediaQueue();
      }, 100);
    };
    mediaPlayer.appendChild(skipButton);
    
    // If queue is empty after playing current item, clone the queue for looping
    if (mediaQueueState.queue.length === 1) {
      mediaQueueState.queue = [...mediaQueueState.queue];
    }
  } else {
    // If we couldn't create an embed, skip to next item
    mediaQueueState.queue.shift();
    updateMediaQueueDisplay();
    processMediaQueue();
  }
}

// Load required APIs
function loadMediaAPIs() {
  // Load YouTube API
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }
  
  // Load SoundCloud API
  if (!window.SC) {
    const sc = document.createElement('script');
    sc.src = "https://w.soundcloud.com/player/api.js";
    document.head.appendChild(sc);
  }
}

// Call API loader when page loads
loadMediaAPIs();

// Update media queue display
function updateMediaQueueDisplay() {
  const mediaQueueDisplay = document.getElementById('media-queue-display');
  
  if (mediaQueueState.queue.length === 0) {
    mediaQueueDisplay.innerHTML = '<div class="empty-queue">Media queue is empty</div>';
    return;
  }

  mediaQueueDisplay.innerHTML = mediaQueueState.queue.map((item, index) => `
    <div class="queue-item">
      <span class="queue-number">${index + 1}.</span>
      <span class="queue-username">${item.username}</span>
      <span class="queue-text">
        <a href="${item.url}" target="_blank">${item.url}</a>
      </span>
    </div>
  `).join('');
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

// Modified addChatMessage function
function addChatMessage(username, message, tags) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  // Add timestamp
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  messageDiv.appendChild(timestamp);

  // Add username with click handler
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = username;
  
  if (!ttsState.users.has(username.toLowerCase())) {
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
        const linkElement = createLinkElement(url, '');
        messageContent.appendChild(linkElement);
        
        // Add to media queue if enabled
        if (mediaQueueState.enabled) {
          mediaQueueState.queue.push({
            url,
            username: username,
            timestamp: new Date()
          });
          updateMediaQueueDisplay();
          processMediaQueue();
        }
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

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});