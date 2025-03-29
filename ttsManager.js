import * as chatUI from './chatUI.js';
import * as chatUtils from './chatUtils.js';
// Assuming gambleManager might need TTS integration later, keep import commented if not used directly now
// import * as gambleManager from './gambleManager.js';

const tts = window.speechSynthesis;
const ttsToggleButton = document.getElementById('tts-toggle');
const ttsClearQueueButton = document.getElementById('tts-clear-queue');
const ttsAddForm = document.getElementById('tts-add-form');
const ttsFilterToggleButton = document.getElementById('tts-filter-toggle');
const autoAddUserToggle = document.getElementById('auto-add-user-toggle');
const ttsUsersList = document.getElementById('tts-users');

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

export function populateVoiceList() {
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
    // Also update voice selects in the user list if they exist
    if (ttsUsersList) {
        ttsUsersList.querySelectorAll('.tts-user-voice-select').forEach(select => {
            const currentVal = select.value;
            select.innerHTML = voices.map(voice =>
                `<option value="${voice.name}" ${voice.name === currentVal ? 'selected' : ''}>
              ${voice.name} (${voice.lang})
            </option>`
            ).join('');
        });
    }
    // Update voice selects in scheduled events modal
    const scheduledVoiceSelects = document.querySelectorAll('#scheduled-events-list select[data-purpose="voice-select"]');
     scheduledVoiceSelects.forEach(select => {
         const currentVal = select.value;
         select.innerHTML = voices.map(voice => `<option value="${voice.name}" ${(currentVal === voice.name) ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
     });

     // Update voice selects in custom commands modal
     const customCmdVoiceSelects = document.querySelectorAll('#custom-commands-list select[data-purpose="voice-select"]');
      customCmdVoiceSelects.forEach(select => {
         const currentVal = select.value;
         select.innerHTML = voices.map(voice => `<option value="${voice.name}" ${currentVal === voice.name ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
      });
}

export function loadTTSState() {
    ttsState.users = new Map(JSON.parse(localStorage.getItem('ttsUsers') || '[]'));
    ttsState.enabled = localStorage.getItem('ttsEnabled') === 'false' ? false : true;
    ttsState.filterEnabled = localStorage.getItem('ttsFilterEnabled') === 'false' ? false : true;
    mutedUsers = new Set(JSON.parse(localStorage.getItem('mutedUsers') || '[]'));

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

export function saveTTSState() {
    localStorage.setItem('ttsEnabled', ttsState.enabled);
    localStorage.setItem('ttsFilterEnabled', ttsState.filterEnabled);
    localStorage.setItem('ttsUsers', JSON.stringify(Array.from(ttsState.users.entries())));
    saveMutedUsers(); // Also save muted users here for consistency
}

export function resetTTS() {
    if (tts.speaking) {
        tts.cancel();
    }
    ttsState.speaking = false;
    ttsState.currentUtterance = null; // Clear current utterance on reset
    processTTSQueue(); // This will update the display
}

export function clearTTSQueue() {
    ttsState.queue = [];
    if (tts.speaking) {
        tts.cancel(); // This should trigger onend/onerror which calls processTTSQueue
    } else {
        // If not speaking, manually reset state and update display
        ttsState.speaking = false;
        ttsState.currentUtterance = null;
        updateQueueDisplay();
    }
}

export function updateQueueDisplay() {
    const queueDisplay = document.getElementById('tts-queue-display');
    const currentDisplay = document.getElementById('tts-current-display');
    if (!queueDisplay || !currentDisplay) return;

    if (ttsState.currentUtterance) {
        currentDisplay.innerHTML = `
        <div class="current-item">
          <span class="current-icon">🔊</span>
          <span class="current-text">${ttsState.currentUtterance.displayText}</span>
          <span class="current-username">${ttsState.currentUtterance.username}</span>
        </div>
      `;
    } else {
        currentDisplay.innerHTML = '<div class="empty-current">Nothing being read</div>';
    }
    if (ttsState.queue.length === 0) {
        queueDisplay.innerHTML = '<div class="empty-queue">Queue is empty</div>';
    } else {
        queueDisplay.innerHTML = ttsState.queue.map((utterance, index) => `
      <div class="queue-item">
        <span class="queue-number">${index + 1}.</span>
        <span class="queue-username">${utterance.username}</span>
        <span class="queue-text">${utterance.displayText}</span>
      </div>
    `).join('');
    }
}

export function processTTSQueue() {
    if (!ttsState.enabled || ttsState.speaking || ttsState.queue.length === 0) {
        if (!ttsState.speaking) { // Ensure current display is cleared if queue is empty and not speaking
             ttsState.currentUtterance = null;
        }
        updateQueueDisplay();
        return;
    }
    ttsState.speaking = true;
    const utterance = ttsState.queue.shift();
    ttsState.currentUtterance = utterance;
    updateQueueDisplay(); // Update display immediately when starting

    utterance.onend = function() {
        console.log("Utterance ended");
        ttsState.speaking = false;
        ttsState.currentUtterance = null; // Clear current when done
        processTTSQueue(); // Check for next item
    };

    utterance.onerror = function(event) {
        console.error('TTS Error during playback:', event);
        ttsState.speaking = false; // Ensure speaking state is reset
        ttsState.currentUtterance = null;
        // Don't immediately process next, maybe add a small delay or just update display
        updateQueueDisplay();
        // Consider removing the failed utterance or retrying later
        // For now, just stop and update UI
    };

    try {
        tts.speak(utterance);
    } catch (error) {
        console.error('TTS Speak Error:', error);
        ttsState.speaking = false;
        ttsState.currentUtterance = null;
        updateQueueDisplay(); // Update display on immediate error
    }
}

export function queueTTSMessage(text, username) {
    username = username.toLowerCase();
    if (isUserMuted(username)) return;

    // Prevent commands from being read, unless it's a gamble command with text
    const isGambleCmd = window.gambleManager && window.gambleManager.isGambleTrigger(text.toLowerCase());
    if (text.startsWith('!') && !isGambleCmd) {
        return; // Don't read standard commands
    }

    // Handle gamble command text if present
    let textToRead = text;
    if (isGambleCmd) {
         const triggerMatched = window.gambleManager.getGambleTriggers().find(trigger => text.toLowerCase().startsWith(trigger.toLowerCase()));
         textToRead = text.slice(triggerMatched.length).trim();
         if (!textToRead) return; // Don't queue if gamble command has no extra text
    }


    if (!ttsState.enabled || !ttsState.users.has(username)) {
        return;
    }

    const chunks = chatUtils.splitMessageIntoChunks(textToRead);
    const voices = tts.getVoices();
    const voiceName = ttsState.users.get(username);
    const voice = voices.find(v => v.name === voiceName);

    chunks.forEach(function([ttsText, displayText]) {
        if (!ttsText || ttsText.trim().length === 0) return; // Skip empty chunks

        const utterance = new SpeechSynthesisUtterance(ttsText);
        if (voice) {
            utterance.voice = voice;
        }
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.username = username; // Store username
        utterance.displayText = displayText; // Store display text for UI

        ttsState.queue.push(utterance);
    });

    updateQueueDisplay(); // Update queue display once after adding all chunks
    processTTSQueue(); // Start processing if not already speaking
}

export function queueCustomTTSMessage(text, voiceName, username = "System") {
    if (!ttsState.enabled) return; // Check if TTS is enabled globally

    const chunks = chatUtils.splitMessageIntoChunks(text);
    const voices = tts.getVoices();
    const voice = voices.find(v => v.name === voiceName);

    chunks.forEach(function([ttsText, displayText]) {
       if (!ttsText || ttsText.trim().length === 0) return;

        const utterance = new SpeechSynthesisUtterance(ttsText);
        if (voice) {
            utterance.voice = voice;
        } else {
             // Fallback to default voice if specified one not found
             console.warn(`Custom TTS voice "${voiceName}" not found, using default.`);
        }
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.username = username;
        utterance.displayText = displayText;

        ttsState.queue.push(utterance);
    });

    updateQueueDisplay();
    processTTSQueue();
}

export function playCustomAudio(audioData) {
     if (!ttsState.enabled) return; // Respect global TTS setting for audio too? (Optional)
     if (!audioData) {
         console.warn("Attempted to play empty custom audio.");
         return;
     }
     // Reconstruct if chunked
     if (Array.isArray(audioData)) {
       audioData = audioData.join('');
     }
    const audio = new Audio(audioData);
    audio.play().catch(function(error) {
        console.error('Audio Playback Error:', error);
    });
}


export function addTTSUser(username, voiceName) {
    username = username.toLowerCase();
    const voices = tts.getVoices();
    if (!voiceName && voices.length > 0) { // Assign random if no voice specified
       voiceName = voices[Math.floor(Math.random() * voices.length)].name;
    } else if (!voiceName) { // No voices available yet
       voiceName = ''; // Set empty, will be updated later
    }

    if (!ttsState.users.has(username)) {
        ttsState.users.set(username, voiceName);
        saveTTSState();
        updateTTSUsersList();
    } else { // If user exists, update their voice maybe? Or just ignore? Let's update.
        updateUserVoice(username, voiceName);
    }
}

export function removeTTSUser(username) {
    username = username.toLowerCase();
    if (ttsState.users.delete(username)) {
        saveTTSState();
        updateTTSUsersList();
    }
}

export function updateUserVoice(username, voiceName) {
    username = username.toLowerCase();
    if (ttsState.users.has(username)) {
        // Apply blacklist check if voiceSettings module is available
        if (window.voiceSettings && window.voiceSettings.isVoiceBlacklisted) {
             if (window.voiceSettings.isVoiceBlacklisted(voiceName)) {
                 const allowed = window.voiceSettings.getAllowedVoices();
                 if (allowed.length > 0) {
                     const newVoice = allowed[Math.floor(Math.random() * allowed.length)].name;
                      chatUI.addSystemMessage(`${username}'s selected voice "${voiceName}" is blacklisted. Switched to "${newVoice}".`);
                     voiceName = newVoice;
                 } else {
                      chatUI.addSystemMessage(`Warning: ${username}'s selected voice "${voiceName}" is blacklisted, and no allowed voices are available!`);
                     // Keep the blacklisted voice? Or remove the user? For now, keep.
                 }
             }
        }

        ttsState.users.set(username, voiceName);

        // Update voice for queued messages from this user
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
        // Update the specific user's select in the list, no need to redraw all
        const userDiv = ttsUsersList.querySelector(`.tts-user[data-username="${username}"]`);
        if (userDiv) {
             const select = userDiv.querySelector('select');
             if (select) select.value = voiceName;
        }
        // No need to call updateTTSUsersList() here if only updating select value
    }
}


export function updateTTSUsersList() {
    if (!ttsUsersList) return;

    const voices = tts.getVoices();
    if (!voices.length) {
        // If voices not ready, schedule a retry? Or just show loading?
        // For now, clear and show message, populateVoiceList handles retries
        ttsUsersList.innerHTML = '<li>Loading voices...</li>';
        return;
    }

    // Clear existing listeners before redrawing
    ttsUsersList.querySelectorAll('.tts-user button, .tts-user select').forEach(el => {
        el.replaceWith(el.cloneNode(true)); // Simple way to remove listeners
    });
    ttsUsersList.innerHTML = ''; // Clear list

    if (ttsState.users.size === 0) {
        ttsUsersList.innerHTML = '<li class="no-users">No users added for TTS yet.</li>'; // Use a list item for consistency
        return;
    }

    ttsState.users.forEach(function(voiceName, username) {
        const div = document.createElement('div');
        div.className = 'tts-user';
        div.dataset.username = username; // Add data attribute for easier selection

        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = username;

        const voiceSelect = document.createElement('select');
        voiceSelect.className = 'tts-user-voice-select'; // Add class for easier selection
        voiceSelect.dataset.username = username;
        voiceSelect.innerHTML = voices.map(function(voice) {
            return `<option value="${voice.name}" ${voice.name === voiceName ? 'selected' : ''}>
              ${voice.name} (${voice.lang})
            </option>`;
        }).join('');
        voiceSelect.addEventListener('change', (e) => {
            updateUserVoice(username, e.target.value);
        });


        const isMuted = isUserMuted(username);
        const muteButton = document.createElement('button');
        muteButton.dataset.username = username;
        muteButton.className = `control-btn toggle-btn ${isMuted ? 'off' : ''}`;
        muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
        muteButton.addEventListener('click', () => {
            toggleMuteUser(username);
        });

        const removeButton = document.createElement('button');
        removeButton.dataset.username = username;
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            removeTTSUser(username);
        });

        div.appendChild(usernameSpan);
        div.appendChild(voiceSelect);
        div.appendChild(muteButton);
        div.appendChild(removeButton);
        ttsUsersList.appendChild(div);
    });
}

export function toggleMuteUser(username) {
    username = username.toLowerCase();
    let message = '';
    if (mutedUsers.has(username)) {
        mutedUsers.delete(username);
        message = `${username} has been unmuted.`; // Changed message for clarity
    } else {
        mutedUsers.add(username);
        message = `${username} has been muted.`;
    }
    saveMutedUsers();
    // Update just the specific user's button in the list
     const userDiv = ttsUsersList.querySelector(`.tts-user[data-username="${username}"]`);
     if (userDiv) {
          const muteButton = userDiv.querySelector('button.toggle-btn');
          if (muteButton) {
              const isMutedNow = mutedUsers.has(username);
              muteButton.textContent = isMutedNow ? 'Unmute' : 'Mute';
              muteButton.classList.toggle('off', isMutedNow);
          }
     }
     // Optionally add system message (can be spammy)
     // chatUI.addSystemMessage(message);
}

export function isUserMuted(username) {
    return mutedUsers.has(username.toLowerCase());
}

// Get current state (used by chatUtils for filter check)
export function getTTSState() {
    return ttsState;
}


// --- Initialization and Event Listeners ---

// Watch for stuck TTS state
setInterval(function() {
    if (ttsState.speaking && !tts.speaking) {
        console.warn("Detected stuck TTS state (browser reported not speaking). Resetting TTS...");
        resetTTS();
    }
    // Add a timeout check in case onend never fires
    // This requires storing the start time of the utterance
}, 2000); // Check every 2 seconds

// Voices might load asynchronously
tts.onvoiceschanged = function() {
    console.log("Voices loaded or changed.");
    populateVoiceList();
    // Maybe re-apply voices to users if default was assigned?
    loadTTSState(); // Reload state to ensure correct voices are assigned if they loaded late
};

// Initial setup calls
populateVoiceList(); // Initial call
loadTTSState(); // Load settings from localStorage

// Setup Event Listeners for controls
if (ttsToggleButton) {
    ttsToggleButton.addEventListener('click', function() {
        ttsState.enabled = !ttsState.enabled;
        this.textContent = ttsState.enabled ? 'TTS Enabled' : 'TTS Disabled';
        this.classList.toggle('off', !ttsState.enabled);
        if (!ttsState.enabled) {
            clearTTSQueue(); // Clear queue when disabling
        } else {
            processTTSQueue(); // Start processing queue if enabled and items exist
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
        const usernameInput = document.getElementById('tts-username');
        const voiceSelect = document.getElementById('tts-voice-select');
        const username = usernameInput.value.toLowerCase().trim();
        const voiceName = voiceSelect.value;
        if (username && voiceName) { // Ensure voice is selected
            addTTSUser(username, voiceName);
            usernameInput.value = ''; // Clear input after adding
        } else if (!voiceName) {
            alert("Please wait for voices to load or select a voice.");
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
        // Default to true if null or not 'false'
        const newValue = !(current === 'true' || current === null);
        localStorage.setItem('autoAddUserEnabled', newValue);
        this.textContent = newValue ? 'Auto Add User: On' : 'Auto Add User: Off';
        this.classList.toggle('off', !newValue);
        // No need to call saveTTSState() as this is a separate localStorage item
    });
}

// Ensure queue display is updated initially
updateQueueDisplay();