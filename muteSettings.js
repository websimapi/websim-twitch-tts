// No imports needed for this simple module

(function() {
    function getSetting(key, defaultVal) {
        const val = localStorage.getItem(key);
        // Handle boolean strings explicitly
        if (val === 'true') return true;
        if (val === 'false') return false;
        // Return parsed value or default
        return val !== null ? val : defaultVal;
    }

    function setSetting(key, value) {
        localStorage.setItem(key, String(value)); // Store as string ('true'/'false' for booleans)
    }

    const allowSelfMuteKey = 'allowSelfMute';
    const selfUnmuteCommandsKey = 'selfUnmuteCommands';
    const selfMuteCommandsKey = 'selfMuteCommands';

    // Default values
    const defaultAllowSelfMute = true;
    const defaultUnmuteCommands = '!tts, !tts-on, !unmute, bonesd3TS';
    const defaultMuteCommands = '!tts-off, !mute, bonesd3TO';

    // UI Elements
    const muteSettingsBtn = document.getElementById('mute-settings-btn');
    const muteSettingsModal = document.getElementById('mute-settings-modal');
    const allowSelfMuteToggle = document.getElementById('allow-self-mute-toggle');
    const selfUnmuteCommandsInput = document.getElementById('self-unmute-commands');
    const selfMuteCommandsInput = document.getElementById('self-mute-commands');
    const saveMuteSettingsBtn = document.getElementById('save-mute-settings');
    const closeMuteSettingsBtn = document.getElementById('close-mute-settings'); // Assuming a close button exists

    let settingsState = {
        allowSelfMute: defaultAllowSelfMute,
        unmuteCommands: [],
        muteCommands: []
    };

    // Load settings from localStorage into the state object
    function loadMuteSettingsState() {
        settingsState.allowSelfMute = getSetting(allowSelfMuteKey, defaultAllowSelfMute);
        const unmuteString = getSetting(selfUnmuteCommandsKey, defaultUnmuteCommands);
        const muteString = getSetting(selfMuteCommandsKey, defaultMuteCommands);

        settingsState.unmuteCommands = unmuteString.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
        settingsState.muteCommands = muteString.split(',').map(s => s.trim().toLowerCase()).filter(s => s);

        // Ensure defaults are saved if nothing was loaded initially
        if (localStorage.getItem(allowSelfMuteKey) === null) {
             setSetting(allowSelfMuteKey, settingsState.allowSelfMute);
        }
         if (localStorage.getItem(selfUnmuteCommandsKey) === null) {
             setSetting(selfUnmuteCommandsKey, settingsState.unmuteCommands.join(', '));
         }
          if (localStorage.getItem(selfMuteCommandsKey) === null) {
             setSetting(selfMuteCommandsKey, settingsState.muteCommands.join(', '));
         }

        updateMuteSettingsButton(); // Update button style based on loaded state
    }

    // Populate the modal fields from the current state object
    function populateModalFromState() {
         if (!allowSelfMuteToggle || !selfUnmuteCommandsInput || !selfMuteCommandsInput) return;
        allowSelfMuteToggle.checked = settingsState.allowSelfMute;
        // Display the commands as stored (comma-separated string)
        selfUnmuteCommandsInput.value = getSetting(selfUnmuteCommandsKey, defaultUnmuteCommands);
        selfMuteCommandsInput.value = getSetting(selfMuteCommandsKey, defaultMuteCommands);
    }

    // Save settings from modal to state and localStorage
    function saveSettingsFromModal() {
         if (!allowSelfMuteToggle || !selfUnmuteCommandsInput || !selfMuteCommandsInput || !muteSettingsModal) return;

        settingsState.allowSelfMute = allowSelfMuteToggle.checked;
        const unmuteString = selfUnmuteCommandsInput.value;
        const muteString = selfMuteCommandsInput.value;

        // Update state arrays (sanitized)
        settingsState.unmuteCommands = unmuteString.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
        settingsState.muteCommands = muteString.split(',').map(s => s.trim().toLowerCase()).filter(s => s);

        // Save the raw (but trimmed) strings to localStorage
        setSetting(allowSelfMuteKey, settingsState.allowSelfMute);
        setSetting(selfUnmuteCommandsKey, unmuteString.split(',').map(s => s.trim()).filter(s => s).join(', ')); // Save trimmed string
        setSetting(selfMuteCommandsKey, muteString.split(',').map(s => s.trim()).filter(s => s).join(', '));     // Save trimmed string


        updateMuteSettingsButton();
        muteSettingsModal.style.display = 'none';
        alert("Mute settings saved.");
    }


    // Update the Mute Settings button appearance
    function updateMuteSettingsButton() {
        if (!muteSettingsBtn) return;
        if (settingsState.allowSelfMute) {
            muteSettingsBtn.classList.remove('off');
            muteSettingsBtn.style.backgroundColor = '';
        } else {
            muteSettingsBtn.classList.add('off');
            muteSettingsBtn.style.backgroundColor = '#6c757d';
        }
    }

    // --- Event Listeners ---
    if (muteSettingsBtn) {
        muteSettingsBtn.addEventListener('click', () => {
             // No need to reload state here, just populate modal from current state
            populateModalFromState();
            if (muteSettingsModal) muteSettingsModal.style.display = 'block';
        });
    }

    if (saveMuteSettingsBtn) {
        saveMuteSettingsBtn.addEventListener('click', saveSettingsFromModal);
    }

    if (closeMuteSettingsBtn) {
        closeMuteSettingsBtn.addEventListener('click', () => {
             // Add unsaved changes check here if desired
            if (muteSettingsModal) muteSettingsModal.style.display = 'none';
        });
    }

    // Clicking outside modal-content closes modal
    window.addEventListener('click', (e) => {
        if (muteSettingsModal && e.target === muteSettingsModal) {
             // Add unsaved changes check here if desired
            muteSettingsModal.style.display = 'none';
        }
    });

    // --- Public API (using window object for simplicity) ---
    window.muteSettings = {
        loadMuteSettings: loadMuteSettingsState, // Function to load/reload state
        updateMuteSettingsButton: updateMuteSettingsButton, // Function to update button
        getAllowSelfMute: () => settingsState.allowSelfMute,
        getUnmuteCommands: () => [...settingsState.unmuteCommands], // Return copy
        getMuteCommands: () => [...settingsState.muteCommands]   // Return copy
    };

    // --- Initial Load ---
    document.addEventListener('DOMContentLoaded', () => {
         loadMuteSettingsState(); // Load state when DOM is ready
    });

})();