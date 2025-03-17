(function() {
  const voiceSettingsBtn = document.getElementById('voice-settings-btn');
  const voiceSettingsModal = document.getElementById('voice-settings-modal');
  const voicePickToggle = document.getElementById('voice-pick-toggle');
  const blacklistContainer = document.getElementById('blacklisted-voices-dropdown'); 
  const saveVoiceSettingsBtn = document.getElementById('save-voice-settings');
  const closeVoiceSettingsBtn = document.getElementById('close-voice-settings');

  function loadVoiceSettings() {
    const pickVoiceEnabled = localStorage.getItem('pickVoiceEnabled');
    voicePickToggle.checked = (pickVoiceEnabled === 'true');

    const voices = window.speechSynthesis.getVoices();
    const blacklistedStr = localStorage.getItem('blacklistedVoices');
    let storedBlacklist = [];
    if (blacklistedStr) {
      try {
        storedBlacklist = JSON.parse(blacklistedStr);
      } catch (e) {
        console.error(e);
      }
    }
    blacklistContainer.innerHTML = '';
    voices.forEach(voice => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.marginBottom = '6px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `voice-${voice.name.replace(/\s+/g, '-')}`;
      checkbox.value = voice.name;
      checkbox.checked = storedBlacklist.includes(voice.name);
      checkbox.style.marginRight = '8px';

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = `${voice.name} (${voice.lang})`;

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      blacklistContainer.appendChild(wrapper);
    });
  }

  function saveVoiceSettings() {
    const pickEnabled = voicePickToggle.checked;
    localStorage.setItem('pickVoiceEnabled', pickEnabled);
    const checkboxes = blacklistContainer.querySelectorAll('input[type="checkbox"]');
    const selectedVoices = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    localStorage.setItem('blacklistedVoices', JSON.stringify(selectedVoices));

    applyVoiceBlacklist();
    updateVoiceSettingsButton();
    voiceSettingsModal.style.display = 'none';
  }

  function updateVoiceSettingsButton() {
    if (!voiceSettingsBtn) return;
    const pickEnabled = localStorage.getItem('pickVoiceEnabled') === 'true';
    if (pickEnabled) {
      voiceSettingsBtn.classList.remove('off');
      voiceSettingsBtn.style.backgroundColor = '';
    } else {
      voiceSettingsBtn.classList.add('off');
      voiceSettingsBtn.style.backgroundColor = '#6c757d';
    }
  }

  voiceSettingsBtn.addEventListener('click', () => {
    loadVoiceSettings();
    voiceSettingsModal.style.display = 'block';
  });

  saveVoiceSettingsBtn.addEventListener('click', saveVoiceSettings);
  closeVoiceSettingsBtn.addEventListener('click', () => {
    voiceSettingsModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === voiceSettingsModal) {
      voiceSettingsModal.style.display = 'none';
    }
  });

  function getAllowedVoices() {
    let allVoices = window.speechSynthesis.getVoices();
    const blacklistedStr = localStorage.getItem('blacklistedVoices');
    let blacklist = [];
    if (blacklistedStr) {
      try {
        blacklist = JSON.parse(blacklistedStr);
      } catch(e){}
    }
    return allVoices.filter(v => !blacklist.includes(v.name));
  }

  function applyVoiceBlacklist() {
    const blacklistedStr = localStorage.getItem('blacklistedVoices');
    let blacklist = [];
    if (blacklistedStr) {
      try {
        blacklist = JSON.parse(blacklistedStr);
      } catch(e){}
    }
    const voiceState = window.ttsManager.getTTSState();
    voiceState.users.forEach((voiceName, username) => {
      if (blacklist.includes(voiceName)) {
        const allowed = getAllowedVoices();
        if (allowed.length > 0) {
          const newVoice = allowed[Math.floor(Math.random() * allowed.length)].name;
          window.ttsManager.updateUserVoice(username, newVoice);
          window.chatUI.addSystemMessage(`${username} had a blacklisted voice and was switched to ${newVoice}`);
        }
      }
    });
  }

  const originalUpdateUserVoice = window.ttsManager.updateUserVoice;
  window.ttsManager.updateUserVoice = function(username, voiceName) {
    const blacklistedStr = localStorage.getItem('blacklistedVoices');
    let blacklist = [];
    if (blacklistedStr) {
      try {
        blacklist = JSON.parse(blacklistedStr);
      } catch(e){}
    }
    if (blacklist.includes(voiceName)) {
      const allowed = getAllowedVoices();
      if (allowed.length > 0) {
        voiceName = allowed[Math.floor(Math.random() * allowed.length)].name;
      }
    }
    originalUpdateUserVoice(username, voiceName);
  };

  updateVoiceSettingsButton();
})();