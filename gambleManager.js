import * as chatUI from './chatUI.js'; 
import * as ttsManager from './ttsManager.js'; 

(function() {
    const defaultGambleTriggers = ["!gamblevoice", "!gv", "bonesd3TC"];
    const gambleState = {
        cooldown: 0,
        enabled: true,
        lastUse: new Map()
    };
    let gambleTriggers = []; 

    const gambleSettingsBtn = document.getElementById('gamble-settings-btn');
    const gambleSettingsModal = document.getElementById('gamble-settings-modal');
    const gambleCooldownInput = document.getElementById('gamble-cooldown');
    const gambleEnabledCheckbox = document.getElementById('gamble-enabled');
    const gambleTriggersInput = document.getElementById('gamble-triggers');
    const saveGambleSettingsBtn = document.getElementById('save-gamble-settings');
    const restoreGambleDefaultsBtn = document.getElementById('restore-gamble-defaults'); 
    const unsavedWarning = document.getElementById('gamble-unsaved-warning');

    let initialGambleSettings = {};
    let unsavedPrompted = false;

    function loadGambleSettings() {
         const storedCooldown = localStorage.getItem('gambleCooldown');
         const storedEnabled = localStorage.getItem('gambleEnabled');
         const storedTriggers = localStorage.getItem('gambleTriggers');

         gambleState.cooldown = storedCooldown !== null ? parseInt(storedCooldown) : 0;
         gambleState.enabled = storedEnabled !== null ? (storedEnabled === 'true') : true;
         try {
             gambleTriggers = storedTriggers ? JSON.parse(storedTriggers) : [...defaultGambleTriggers];
         } catch (e) {
             console.error("Error parsing gamble triggers, using defaults.", e);
             gambleTriggers = [...defaultGambleTriggers];
         }

         updateGambleSettingsButton(); 
    }

    function updateGambleSettingsButton() {
        if (!gambleSettingsBtn) return;
        if (gambleState.enabled) {
            gambleSettingsBtn.classList.remove('off');
            gambleSettingsBtn.style.backgroundColor = '';
        } else {
            gambleSettingsBtn.classList.add('off');
            gambleSettingsBtn.style.backgroundColor = '#6c757d';
        }
    }

    function loadGambleSettingsIntoModal() {
        if (!gambleCooldownInput || !gambleEnabledCheckbox || !gambleTriggersInput || !unsavedWarning) return;

        gambleCooldownInput.value = gambleState.cooldown;
        gambleEnabledCheckbox.checked = gambleState.enabled;
        gambleTriggersInput.value = gambleTriggers.join(', ');

        initialGambleSettings = {
            cooldown: gambleCooldownInput.value,
            enabled: gambleEnabledCheckbox.checked,
            triggers: gambleTriggersInput.value
        };
        unsavedPrompted = false;
        unsavedWarning.style.display = 'none';
    }

    function hasUnsavedChanges() {
         if (!gambleCooldownInput || !gambleEnabledCheckbox || !gambleTriggersInput) return false;
        return (
            gambleCooldownInput.value !== initialGambleSettings.cooldown ||
            gambleEnabledCheckbox.checked !== initialGambleSettings.enabled ||
            gambleTriggersInput.value !== initialGambleSettings.triggers
        );
    }

    function saveSettingsFromModal() {
        if (!gambleCooldownInput || !gambleEnabledCheckbox || !gambleTriggersInput || !gambleSettingsModal) return;

        gambleState.cooldown = parseInt(gambleCooldownInput.value) || 0;
        gambleState.enabled = gambleEnabledCheckbox.checked;
        
        gambleTriggers = gambleTriggersInput.value
            .split(',')
            .map(trigger => trigger.trim().toLowerCase())
            .filter(trigger => trigger);

        if (gambleTriggers.length === 0) {
             gambleTriggers = [...defaultGambleTriggers].map(t => t.toLowerCase());
             gambleTriggersInput.value = gambleTriggers.join(', '); 
             alert("No valid triggers entered, restored defaults.");
        }

        localStorage.setItem('gambleCooldown', gambleState.cooldown);
        localStorage.setItem('gambleEnabled', gambleState.enabled);
        localStorage.setItem('gambleTriggers', JSON.stringify(gambleTriggers));

        updateGambleSettingsButton(); 
        gambleSettingsModal.style.display = 'none';
    }

    if (gambleSettingsBtn) {
        gambleSettingsBtn.addEventListener('click', function() {
            loadGambleSettingsIntoModal(); 
            if (gambleSettingsModal) gambleSettingsModal.style.display = 'block';
        });
    }

    if (saveGambleSettingsBtn) {
        saveGambleSettingsBtn.addEventListener('click', saveSettingsFromModal);
    }

    if (restoreGambleDefaultsBtn && gambleTriggersInput) {
        restoreGambleDefaultsBtn.addEventListener('click', function() {
            gambleTriggersInput.value = defaultGambleTriggers.join(', ');
        });
    }

    window.addEventListener('click', function(e) {
        if (gambleSettingsModal && e.target === gambleSettingsModal) {
            if (hasUnsavedChanges()) {
                if (!unsavedPrompted && unsavedWarning) {
                    unsavedWarning.textContent = "You have unsaved changes. Click outside again to close without saving.";
                    unsavedWarning.style.display = 'block';
                    unsavedPrompted = true;
                } else {
                    loadGambleSettingsIntoModal(); 
                    gambleSettingsModal.style.display = 'none';
                }
            } else {
                gambleSettingsModal.style.display = 'none';
            }
        }
    });

    const closeBtn = gambleSettingsModal ? gambleSettingsModal.querySelector('.close-btn') : null; 
    if (closeBtn) {
         closeBtn.addEventListener('click', () => {
             if (hasUnsavedChanges() && confirm("You have unsaved changes. Close anyway?")) {
                  loadGambleSettingsIntoModal(); 
                  gambleSettingsModal.style.display = 'none';
             } else if (!hasUnsavedChanges()) {
                  gambleSettingsModal.style.display = 'none';
             }
         });
     }

    function isGambleTrigger(message) {
        const lowerMessage = message.toLowerCase().trim();
        return gambleTriggers.some(trigger => lowerMessage.startsWith(trigger));
    }

    function isOnGambleCooldown(username) {
        if (gambleState.cooldown <= 0) return false; 
        const lastUseTimestamp = gambleState.lastUse.get(username.toLowerCase());
        if (!lastUseTimestamp) return false; 
        const timeSinceLastUse = Date.now() - lastUseTimestamp;
        return timeSinceLastUse < (gambleState.cooldown * 1000);
    }

    function handleGambleCommand(username, message) {
        const lowerUsername = username.toLowerCase();

        if (!gambleState.enabled) {
            return false; 
        }

        if (isOnGambleCooldown(lowerUsername)) {
            const lastUseTimestamp = gambleState.lastUse.get(lowerUsername);
            const remainingTime = Math.ceil((gambleState.cooldown * 1000 - (Date.now() - lastUseTimestamp)) / 1000);
            chatUI.addSystemMessage(`${username} must wait ${remainingTime}s before using gamble voice again.`);
            return true; 
        }

        let allowedVoices = [];
        if (window.voiceSettings && window.voiceSettings.getAllowedVoices) {
             allowedVoices = window.voiceSettings.getAllowedVoices();
         } else {
             allowedVoices = window.speechSynthesis.getVoices(); 
         }

        if (allowedVoices.length === 0) {
            chatUI.addSystemMessage("No voices available to gamble.");
            return true; 
        }

        const currentUserVoiceName = ttsManager.getTTSState().users.get(lowerUsername);
        let newVoice;

        if (allowedVoices.length <= 1 && currentUserVoiceName && allowedVoices[0].name === currentUserVoiceName) {
             chatUI.addSystemMessage(`${username} is already using the only available voice.`);
             gambleState.lastUse.set(lowerUsername, Date.now());
             return true; 
         }

        let attempts = 0;
        do {
            newVoice = allowedVoices[Math.floor(Math.random() * allowedVoices.length)];
            attempts++;
        } while (newVoice.name === currentUserVoiceName && allowedVoices.length > 1 && attempts < allowedVoices.length * 2); 

        ttsManager.updateUserVoice(lowerUsername, newVoice.name);
        gambleState.lastUse.set(lowerUsername, Date.now()); 

        chatUI.addSystemMessage(`${username} rolled and got a new voice: ${newVoice.name}`);

        const lowerMessage = message.toLowerCase().trim();
        const triggerMatched = gambleTriggers.find(trigger => lowerMessage.startsWith(trigger));
        const additionalText = message.slice(triggerMatched.length).trim();

        if (additionalText && !ttsManager.isUserMuted(lowerUsername)) {
             ttsManager.queueTTSMessage(additionalText, lowerUsername);
         } 

        return true; 
    }

    window.gambleManager = {
        loadGambleSettings: loadGambleSettings, 
        loadGambleSettingsIntoModal: loadGambleSettingsIntoModal, 
        isGambleTrigger: isGambleTrigger,
        handleGambleCommand: handleGambleCommand,
        isOnGambleCooldown: isOnGambleCooldown,
        getGambleTriggers: () => [...gambleTriggers] 
    };

    document.addEventListener('DOMContentLoaded', () => {
         loadGambleSettings(); 
    });

})();