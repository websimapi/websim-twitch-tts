(function() {
  function getSetting(key, defaultVal) {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultVal;
  }
  
  function setSetting(key, value) {
    localStorage.setItem(key, value);
  }
  
  const allowSelfMuteKey = 'allowSelfMute';
  const selfUnmuteCommandsKey = 'selfUnmuteCommands';
  const selfMuteCommandsKey = 'selfMuteCommands';
  
  // Set defaults if not already set
  if (localStorage.getItem(allowSelfMuteKey) === null) {
    setSetting(allowSelfMuteKey, 'true');
  }
  if (localStorage.getItem(selfUnmuteCommandsKey) === null) {
    setSetting(selfUnmuteCommandsKey, '!tts, !tts-on, !unmute, bonesd3TS');
  }
  if (localStorage.getItem(selfMuteCommandsKey) === null) {
    setSetting(selfMuteCommandsKey, '!tts-off, !mute, bonesd3TO');
  }
  
  const muteSettingsBtn = document.getElementById('mute-settings-btn');
  const muteSettingsModal = document.getElementById('mute-settings-modal');
  const allowSelfMuteToggle = document.getElementById('allow-self-mute-toggle');
  const selfUnmuteCommandsInput = document.getElementById('self-unmute-commands');
  const selfMuteCommandsInput = document.getElementById('self-mute-commands');
  const saveMuteSettingsBtn = document.getElementById('save-mute-settings');
  const closeMuteSettingsBtn = document.getElementById('close-mute-settings');
  
  // Initialize the modal fields from settings
  function loadMuteSettings() {
    allowSelfMuteToggle.checked = getSetting(allowSelfMuteKey, 'true') === 'true';
    selfUnmuteCommandsInput.value = getSetting(selfUnmuteCommandsKey, '!tts, !tts-on, !unmute, bonesd3TS');
    selfMuteCommandsInput.value = getSetting(selfMuteCommandsKey, '!tts-off, !mute, bonesd3TO');
  }
  
  muteSettingsBtn.addEventListener('click', () => {
    loadMuteSettings();
    muteSettingsModal.style.display = 'block';
  });
  
  saveMuteSettingsBtn.addEventListener('click', () => {
    setSetting(allowSelfMuteKey, allowSelfMuteToggle.checked ? 'true' : 'false');
    setSetting(selfUnmuteCommandsKey, selfUnmuteCommandsInput.value);
    setSetting(selfMuteCommandsKey, selfMuteCommandsInput.value);
    muteSettingsModal.style.display = 'none';
    updateMuteSettingsButton();
  });
  
  closeMuteSettingsBtn.addEventListener('click', () => {
    muteSettingsModal.style.display = 'none';
  });
  
  // Clicking outside modal-content closes modal
  window.addEventListener('click', (e) => {
    if (e.target === muteSettingsModal) {
      muteSettingsModal.style.display = 'none';
    }
  });

  // Update the Mute Settings button's appearance based on whether self mute is allowed or not.
  function updateMuteSettingsButton() {
    if (!muteSettingsBtn) return;
    const allowSelfMute = localStorage.getItem(allowSelfMuteKey) === 'true';
    if (allowSelfMute) {
      muteSettingsBtn.classList.remove('off');
      muteSettingsBtn.style.backgroundColor = '';
    } else {
      muteSettingsBtn.classList.add('off');
      muteSettingsBtn.style.backgroundColor = '#6c757d';
    }
  }
  
  // Ensure the button is updated on page load.
  updateMuteSettingsButton();
})();