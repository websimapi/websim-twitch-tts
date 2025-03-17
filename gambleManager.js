(function() {
  // Create logger for this module
  const logger = window.debugLogger ? window.debugLogger.createLogger('GambleManager') : console;
  
  const defaultGambleTriggers = ["!gamblevoice", "!gv", "bonesd3TC"];
  const gambleState = {
    cooldown: parseInt(localStorage.getItem('gambleCooldown')) || 0,
    enabled: localStorage.getItem('gambleEnabled') === 'false' ? false : true,
    lastUse: new Map()
  };
  
  let gambleTriggers;
  try {
    gambleTriggers = JSON.parse(localStorage.getItem('gambleTriggers') || JSON.stringify(defaultGambleTriggers));
    logger.info('Loaded gamble triggers', gambleTriggers);
  } catch (error) {
    logger.error('Failed to parse gamble triggers from localStorage', error.toString());
    gambleTriggers = [...defaultGambleTriggers];
  }

  const gambleSettingsBtn = document.getElementById('gamble-settings-btn');
  const gambleSettingsModal = document.getElementById('gamble-settings-modal');
  const gambleCooldownInput = document.getElementById('gamble-cooldown');
  const gambleEnabledCheckbox = document.getElementById('gamble-enabled');
  const gambleTriggersInput = document.getElementById('gamble-triggers');
  const saveGambleSettingsBtn = document.getElementById('save-gamble-settings');
  const restoreGambleDefaultsBtn = document.getElementById('restore-gamble-defaults');
  const unsavedWarning = document.getElementById('gamble-unsaved-warning');

  // Variables to track unsaved changes for gamble settings
  let initialGambleSettings = {};
  let unsavedPrompted = false;

  // Helper: Update Gamble Settings button style based on enabled status
  function updateGambleSettingsButton() {
    if (!gambleSettingsBtn || !gambleEnabledCheckbox) return;
    if (gambleEnabledCheckbox.checked) {
      gambleSettingsBtn.classList.remove('off');
      gambleSettingsBtn.style.backgroundColor = '';
    } else {
      gambleSettingsBtn.classList.add('off');
      gambleSettingsBtn.style.backgroundColor = '#6c757d';
    }
  }

  // Set initial values in the modal based on stored settings
  function loadGambleSettingsIntoModal() {
    if (gambleCooldownInput) {
      gambleCooldownInput.value = gambleState.cooldown;
    }
    if (gambleEnabledCheckbox) {
      gambleEnabledCheckbox.checked = gambleState.enabled;
    }
    if (gambleTriggersInput) {
      gambleTriggersInput.value = gambleTriggers.join(', ');
    }
    // Record initial state for later comparison
    initialGambleSettings = {
      cooldown: gambleCooldownInput.value,
      enabled: gambleEnabledCheckbox.checked,
      triggers: gambleTriggersInput.value
    };
    unsavedPrompted = false;
    unsavedWarning.style.display = 'none';
  }

  // Compare current modal values with initial values
  function hasUnsavedChanges() {
    return (
      gambleCooldownInput.value !== initialGambleSettings.cooldown ||
      gambleEnabledCheckbox.checked !== initialGambleSettings.enabled ||
      gambleTriggersInput.value !== initialGambleSettings.triggers
    );
  }

  // Open modal and load settings
  gambleSettingsBtn.addEventListener('click', function() {
    loadGambleSettingsIntoModal();
    gambleSettingsModal.style.display = 'block';
  });

  // Save settings from modal
  saveGambleSettingsBtn.addEventListener('click', function() {
    gambleState.cooldown = parseInt(gambleCooldownInput.value) || 0;
    gambleState.enabled = gambleEnabledCheckbox.checked;
    gambleTriggers = gambleTriggersInput.value.split(',')
      .map(trigger => trigger.trim())
      .filter(trigger => trigger);
    localStorage.setItem('gambleCooldown', gambleState.cooldown);
    localStorage.setItem('gambleEnabled', gambleState.enabled);
    localStorage.setItem('gambleTriggers', JSON.stringify(gambleTriggers));
    gambleSettingsModal.style.display = 'none';
    updateGambleSettingsButton();
  });

  // Restore default triggers for gamble settings
  restoreGambleDefaultsBtn.addEventListener('click', function() {
    gambleTriggers = [...defaultGambleTriggers];
    gambleTriggersInput.value = gambleTriggers.join(', ');
    localStorage.setItem('gambleTriggers', JSON.stringify(gambleTriggers));
  });

  // Enhanced modal close behavior: clicking outside the modal content for Gamble Settings
  window.addEventListener('click', function(e) {
    if (e.target === gambleSettingsModal) {
      if (hasUnsavedChanges()) {
        if (!unsavedPrompted) {
          unsavedWarning.textContent = "You have unsaved changes. Click outside again to cancel.";
          unsavedWarning.style.display = 'block';
          unsavedPrompted = true;
        } else {
          // Revert the unsaved changes by resetting modal values to initial state
          gambleCooldownInput.value = initialGambleSettings.cooldown;
          gambleEnabledCheckbox.checked = initialGambleSettings.enabled;
          gambleTriggersInput.value = initialGambleSettings.triggers;
          unsavedWarning.style.display = 'none';
          unsavedPrompted = false;
          gambleSettingsModal.style.display = 'none';
        }
      } else {
        gambleSettingsModal.style.display = 'none';
      }
    }
  });

  function isGambleTrigger(message) {
    return gambleTriggers.some(trigger => message.startsWith(trigger.toLowerCase()));
  }

  function isOnGambleCooldown(username) {
    if (gambleState.cooldown === 0) return false;
    const lastUse = gambleState.lastUse.get(username);
    if (!lastUse) return false;
    const timeSinceLastUse = Date.now() - lastUse;
    return timeSinceLastUse < (gambleState.cooldown * 1000);
  }

  function handleGambleCommand(username, message) {
    username = username.toLowerCase();
    if (!gambleState.enabled) {
      logger.info('Gamble command rejected - feature disabled');
      window.chatUI.addSystemMessage("Gamble Voice command is currently disabled");
      window.ttsManager.queueTTSMessage("Gamble Voice command is currently disabled", "System");
      return true;
    }
    
    if (isOnGambleCooldown(username)) {
      const lastUse = gambleState.lastUse.get(username);
      const remainingTime = Math.ceil((gambleState.cooldown * 1000 - (Date.now() - lastUse)) / 1000);
      logger.info(`Gamble command rejected - user ${username} on cooldown for ${remainingTime}s`);
      window.chatUI.addSystemMessage(`${username} must wait ${remainingTime} seconds before using gamble voice again`);
      return true;
    }
    
    const voices = window.speechSynthesis.getVoices();
    const currentVoice = window.ttsManager.getTTSState().users.get(username);
    let newVoice;
    if (voices.length) {
      do {
        newVoice = voices[Math.floor(Math.random() * voices.length)].name;
      } while (newVoice === currentVoice && voices.length > 1);
    }
    window.ttsManager.updateUserVoice(username, newVoice);
    gambleState.lastUse.set(username, Date.now());
    window.chatUI.addSystemMessage(`${username} rolled and got a new voice: ${newVoice}`);
    window.ttsManager.queueTTSMessage(`${username} rolled for a new voice`, 'System');

    const triggerMatched = gambleTriggers.find(trigger => message.toLowerCase().startsWith(trigger.toLowerCase()));
    const additionalText = message.slice(triggerMatched.length).trim();
    if (additionalText) {
      window.ttsManager.queueTTSMessage(additionalText, username);
    }
    logger.info(`User ${username} rolled for a new voice and got: ${newVoice}`);
    return true;
  }

  window.gambleManager = {
    isGambleTrigger: isGambleTrigger,
    handleGambleCommand: handleGambleCommand,
    isOnGambleCooldown: isOnGambleCooldown
  };

  // Immediately update the Gamble Settings button based on stored value on page load
  updateGambleSettingsButton();
})();