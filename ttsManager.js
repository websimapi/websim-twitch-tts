(function() {
  // Create logger for this module
  const logger = window.debugLogger.createLogger('TTSManager');
  
  const tts = window.speechSynthesis;
  const ttsToggleButton = document.getElementById('tts-toggle');
  const ttsClearQueueButton = document.getElementById('tts-clear-queue');
  const ttsAddForm = document.getElementById('tts-add-form');
  const ttsFilterToggleButton = document.getElementById('tts-filter-toggle');
  const autoAddUserToggle = document.getElementById('auto-add-user-toggle');

  const ttsState = {
    enabled: localStorage.getItem('ttsEnabled') === 'false' ? false : true,
    filterEnabled: localStorage.getItem('ttsFilterEnabled') === 'false' ? false : true,
    users: new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]')),
    queue: [],
    speaking: false,
    currentUtterance: null
  };

  let mutedUsers = new Set(JSON.parse(localStorage.getItem('mutedUsers') || '[]'));
  function saveMutedUsers() {
    localStorage.setItem('mutedUsers', JSON.stringify(Array.from(mutedUsers)));
  }

  function populateVoiceList() {
    const voices = tts.getVoices();
    if (!voices.length) {
      setTimeout(populateVoiceList, 100);
      return;
    }
    const ttsVoiceSelect = document.getElementById('tts-voice-select');
    if (ttsVoiceSelect) {
      ttsVoiceSelect.innerHTML = voices.map(voice =>
        `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`
      ).join('');
    }
  }

  function loadTTSState() {
    logger.info('Loading TTS state from localStorage');
    ttsState.users = new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]'));
    if(ttsToggleButton) {
      ttsToggleButton.textContent = ttsState.enabled ? 'TTS Enabled' : 'TTS Disabled';
      ttsToggleButton.classList.toggle('off', !ttsState.enabled);
    }
    if(ttsFilterToggleButton) {
      ttsFilterToggleButton.textContent = ttsState.filterEnabled ? 'Filter Enabled' : 'Filter Disabled';
      ttsFilterToggleButton.classList.toggle('off', !ttsState.filterEnabled);
    }
    if(autoAddUserToggle) {
      let autoAddUserEnabled = localStorage.getItem('autoAddUserEnabled');
      autoAddUserEnabled = autoAddUserEnabled === null ? true : autoAddUserEnabled === 'true';
      autoAddUserToggle.textContent = autoAddUserEnabled ? 'Auto Add User: On' : 'Auto Add User: Off';
      autoAddUserToggle.classList.toggle('off', !autoAddUserEnabled);
    }
    updateTTSUsersList();
  }

  function saveTTSState() {
    localStorage.setItem('ttsEnabled', ttsState.enabled);
    localStorage.setItem('ttsFilterEnabled', ttsState.filterEnabled);
    localStorage.setItem('ttsUsers', JSON.stringify(Array.from(ttsState.users.entries())));
  }

  function resetTTS() {
    logger.warn('Resetting TTS state due to error or manual reset');
    if (tts.speaking) {
      tts.cancel();
    }
    ttsState.speaking = false;
    processTTSQueue();
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

  function processTTSQueue() {
    if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
      updateQueueDisplay();
      return;
    }
    ttsState.speaking = true;
    const utterance = ttsState.queue.shift();
    ttsState.currentUtterance = utterance;
    updateQueueDisplay();
    
    utterance.onstart = function() {
      updateQueueDisplay();
    };

    utterance.onend = function() {
      ttsState.speaking = false;
      processTTSQueue();
    };

    utterance.onerror = function() {
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

  function queueTTSMessage(text, username) {
    username = username.toLowerCase();
    if (window.ttsManager.isUserMuted(username)) {
      logger.debug(`Skip TTS for muted user: ${username}`);
      return;
    }
    
    if (text[0] === '!' && !(window.gambleManager && window.gambleManager.isGambleTrigger(text.toLowerCase()))) {
      logger.debug(`Skip TTS for command: ${text}`);
      return;
    }
    
    if (!ttsState.enabled || !ttsState.users.has(username)) {
      logger.debug(`Skip TTS - enabled: ${ttsState.enabled}, user registered: ${ttsState.users.has(username)}`);
      return;
    }
    
    logger.info(`Queueing TTS message for ${username}`, text);
    const chunks = window.chatUtils.splitMessageIntoChunks(text);
    const voices = tts.getVoices();
    const voiceName = ttsState.users.get(username);
    const voice = voices.find(v => v.name === voiceName);
    chunks.forEach(function([ttsText, displayText]) {
      const utterance = new SpeechSynthesisUtterance(ttsText);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.username = username;
      utterance.displayText = displayText;
      utterance.onerror = function(event) {
        console.error('TTS Error:', event);
        resetTTS();
      };
      ttsState.queue.push(utterance);
      updateQueueDisplay();
    });
    processTTSQueue();
  }

  function queueCustomTTSMessage(text, voiceName, username) {
    const chunks = window.chatUtils.splitMessageIntoChunks(text);
    const voices = tts.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    chunks.forEach(function([ttsText, displayText]) {
      const utterance = new SpeechSynthesisUtterance(ttsText);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.username = username;
      utterance.displayText = displayText;
      utterance.onerror = function(event) {
        console.error('TTS Error:', event);
        resetTTS();
      };
      ttsState.queue.push(utterance);
      updateQueueDisplay();
    });
    processTTSQueue();
  }

  function playCustomAudio(audioData) {
    if (Array.isArray(audioData)) {
      audioData = audioData.join('');
    }
    const audio = new Audio(audioData);
    audio.play().catch(function(error) {
      console.error('Audio Playback Error:', error);
    });
  }

  function addTTSUser(username, voiceName) {
    username = username.toLowerCase();
    if (!ttsState.users.has(username)) {
      ttsState.users.set(username, voiceName);
      saveTTSState();
      updateTTSUsersList();
    }
  }

  function removeTTSUser(username) {
    username = username.toLowerCase();
    ttsState.users.delete(username);
    saveTTSState();
    updateTTSUsersList();
  }

  function updateUserVoice(username, voiceName) {
    username = username.toLowerCase();
    if (ttsState.users.has(username)) {
      ttsState.users.set(username, voiceName);
      const voices = tts.getVoices();
      const newVoice = voices.find(v => v.name === voiceName);
      if (newVoice) {
        ttsState.queue.forEach(function(utterance) {
          if (utterance.username === username) {
            utterance.voice = newVoice;
          }
        });
      }
      saveTTSState();
      updateTTSUsersList();
    }
  }

  function updateTTSUsersList() {
    const ttsUsersList = document.getElementById('tts-users');
    const voices = tts.getVoices();
    if (!ttsUsersList) return;
    if (!voices.length) {
      setTimeout(updateTTSUsersList, 100);
      return;
    }
    ttsUsersList.innerHTML = '';
    ttsState.users.forEach(function(voiceName, username) {
      const div = document.createElement('div');
      div.className = 'tts-user';
      const voiceSelectHTML = `
        <select onchange="window.ttsManager.updateUserVoice('${username}', this.value)">
          ${voices.map(function(voice) {
            return `<option value="${voice.name}" ${voice.name === voiceName ? 'selected' : ''}>
              ${voice.name} (${voice.lang})
            </option>`;
          }).join('')}
        </select>
      `;
      const isMuted = window.ttsManager.isUserMuted(username);
      const muteButtonHTML = `<button onclick="window.ttsManager.toggleMuteUser('${username}')" class="control-btn ${isMuted ? 'toggle-btn off' : 'toggle-btn'}">${isMuted ? 'Unmute' : 'Mute'}</button>`;
      div.innerHTML = `
        <span>${username}</span>
        ${voiceSelectHTML}
        ${muteButtonHTML}
        <button onclick="window.ttsManager.removeTTSUser('${username}')">×</button>
      `;
      ttsUsersList.appendChild(div);
    });
  }

  function toggleMuteUser(username) {
    username = username.toLowerCase();
    if (mutedUsers.has(username)) {
      mutedUsers.delete(username);
      window.chatUI.addSystemMessage(`${username} has unmuted themselves.`);
    } else {
      mutedUsers.add(username);
      window.chatUI.addSystemMessage(`${username} has muted themselves.`);
    }
    saveMutedUsers();
    updateTTSUsersList();
  }
  
  function isUserMuted(username) {
    return mutedUsers.has(username.toLowerCase());
  }

  setInterval(function() {
    if (ttsState.speaking && !tts.speaking) {
      console.log("Detected stuck TTS state, resetting...");
      resetTTS();
    }
  }, 1000);

  tts.onvoiceschanged = function() {
    populateVoiceList();
    loadTTSState();
  };

  populateVoiceList();
  loadTTSState();

  if (ttsToggleButton) {
    ttsToggleButton.addEventListener('click', function() {
      ttsState.enabled = !ttsState.enabled;
      this.textContent = ttsState.enabled ? 'TTS Enabled' : 'TTS Disabled';
      this.classList.toggle('off', !ttsState.enabled);
      if (!ttsState.enabled) {
        clearTTSQueue();
      }
      saveTTSState();
    });
  }

  if (ttsClearQueueButton) {
    ttsClearQueueButton.addEventListener('click', clearTTSQueue);
  }

  if (ttsAddForm) {
    ttsAddForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const username = document.getElementById('tts-username').value.toLowerCase().trim();
      const voiceName = document.getElementById('tts-voice-select').value;
      if (username) {
        addTTSUser(username, voiceName);
        document.getElementById('tts-username').value = '';
      }
    });
  }

  if (ttsFilterToggleButton) {
    ttsFilterToggleButton.addEventListener('click', function() {
      ttsState.filterEnabled = !ttsState.filterEnabled;
      this.textContent = ttsState.filterEnabled ? 'Filter Enabled' : 'Filter Disabled';
      this.classList.toggle('off', !ttsState.filterEnabled);
      saveTTSState();
    });
  }

  if (autoAddUserToggle) {
    autoAddUserToggle.addEventListener('click', function() {
      const current = localStorage.getItem('autoAddUserEnabled');
      const newValue = !(current === 'false' ? false : true);
      localStorage.setItem('autoAddUserEnabled', newValue);
      this.textContent = newValue ? 'Auto Add User: On' : 'Auto Add User: Off';
      this.classList.toggle('off', !newValue);
    });
  }

  window.ttsManager = {
    getTTSState: function() { return ttsState; },
    populateVoiceList: populateVoiceList,
    loadTTSState: loadTTSState,
    saveTTSState: saveTTSState,
    resetTTS: resetTTS,
    clearTTSQueue: clearTTSQueue,
    updateQueueDisplay: updateQueueDisplay,
    processTTSQueue: processTTSQueue,
    queueTTSMessage: queueTTSMessage,
    queueCustomTTSMessage: queueCustomTTSMessage,
    playCustomAudio: playCustomAudio,
    addTTSUser: addTTSUser,
    removeTTSUser: removeTTSUser,
    updateUserVoice: updateUserVoice,
    updateTTSUsersList: updateTTSUsersList,
    toggleMuteUser: toggleMuteUser,
    isUserMuted: isUserMuted
  };
})();