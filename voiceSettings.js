import * as ttsManager from './ttsManager.js'; // Import ttsManager
import * as chatUI from './chatUI.js'; // Import chatUI

// Use IIFE for now
(function() {
    // --- State and Keys ---
    const pickVoiceEnabledKey = 'pickVoiceEnabled';
    const blacklistedVoicesKey = 'blacklistedVoices';
    const pickVoiceTriggerKey = 'pickVoiceTrigger'; // Added for trigger command

    let state = {
        pickVoiceEnabled: true,
        blacklistedVoices: [],
        pickVoiceTrigger: '!pickvoice' // Default trigger
    };

    // --- UI Elements ---
    const voiceSettingsBtn = document.getElementById('voice-settings-btn');
    const voiceSettingsModal = document.getElementById('voice-settings-modal');
    const voicePickToggle = document.getElementById('voice-pick-toggle');
    const pickVoiceTriggerInput = document.getElementById('pick-voice-trigger'); // Added input field
    const blacklistedVoicesContainer = document.getElementById('blacklisted-voices');
    const saveVoiceSettingsBtn = document.getElementById('save-voice-settings');
    const closeVoiceSettingsBtn = document.getElementById('close-voice-settings'); // Assuming exists

    // --- Load and Save ---
    function loadVoiceSettings() {
        state.pickVoiceEnabled = localStorage.getItem(pickVoiceEnabledKey) === 'true'; // Default false if null/not 'true'
        state.pickVoiceTrigger = localStorage.getItem(pickVoiceTriggerKey) || '!pickvoice'; // Load trigger or default
        const blacklistedStr = localStorage.getItem(blacklistedVoicesKey);
        state.blacklistedVoices = blacklistedStr ? JSON.parse(blacklistedStr) : [];

        // Ensure defaults are saved if first load
        if (localStorage.getItem(pickVoiceEnabledKey) === null) {
            localStorage.setItem(pickVoiceEnabledKey, String(state.pickVoiceEnabled));
        }
        if (localStorage.getItem(blacklistedVoicesKey) === null) {
            localStorage.setItem(blacklistedVoicesKey, JSON.stringify(state.blacklistedVoices));
        }
        if (localStorage.getItem(pickVoiceTriggerKey) === null) {
            localStorage.setItem(pickVoiceTriggerKey, state.pickVoiceTrigger);
        }

        populateModal(); // Update modal fields
        updateVoiceSettingsButton(); // Update button style
    }

    function saveVoiceSettings() {
        if (!voicePickToggle || !pickVoiceTriggerInput || !blacklistedVoicesContainer || !voiceSettingsModal) return;

        state.pickVoiceEnabled = voicePickToggle.checked;
        // Sanitize trigger: lowercase, trim, ensure starts with '!', default if empty
        let trigger = pickVoiceTriggerInput.value.trim().toLowerCase();
        if (!trigger) {
            trigger = '!pickvoice'; // Default back if empty
        } else if (!trigger.startsWith('!')) {
            trigger = '!' + trigger; // Ensure it starts with '!'
        }
        state.pickVoiceTrigger = trigger;

        const checkboxes = blacklistedVoicesContainer.querySelectorAll('input[type="checkbox"]');
        state.blacklistedVoices = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        localStorage.setItem(pickVoiceEnabledKey, String(state.pickVoiceEnabled));
        localStorage.setItem(pickVoiceTriggerKey, state.pickVoiceTrigger);
        localStorage.setItem(blacklistedVoicesKey, JSON.stringify(state.blacklistedVoices));

        updateVoiceSettingsButton();
        applyVoiceBlacklist(); // Apply changes immediately to current users
        voiceSettingsModal.style.display = 'none';
        alert('Voice settings saved.');
    }

    // --- UI Updates ---
    function populateModal() {
        if (!voicePickToggle || !pickVoiceTriggerInput || !blacklistedVoicesContainer) return;

        voicePickToggle.checked = state.pickVoiceEnabled;
        pickVoiceTriggerInput.value = state.pickVoiceTrigger;

        const voices = window.speechSynthesis.getVoices();
        blacklistedVoicesContainer.innerHTML = ''; // Clear previous

        if (!voices.length) {
            blacklistedVoicesContainer.innerHTML = '<div>Loading voices...</div>';
            return;
        }

        voices.forEach(voice => {
            const wrapper = document.createElement('div');
            wrapper.className = 'voice-blacklist-item'; // Add class for styling
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = voice.name;
            checkbox.id = 'voice-checkbox-' + voice.name.replace(/[^a-zA-Z0-9]/g, '-'); // Sanitize ID
            checkbox.checked = state.blacklistedVoices.includes(voice.name);

            const label = document.createElement('label');
            label.htmlFor = checkbox.id; // Use htmlFor
            label.textContent = `${voice.name} (${voice.lang})`;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            blacklistedVoicesContainer.appendChild(wrapper);
        });
    }

    function updateVoiceSettingsButton() {
        if (!voiceSettingsBtn) return;
        // Base style on whether pick voice is enabled
        if (state.pickVoiceEnabled) {
            voiceSettingsBtn.classList.remove('off');
            voiceSettingsBtn.style.backgroundColor = '';
        } else {
            voiceSettingsBtn.classList.add('off');
            voiceSettingsBtn.style.backgroundColor = '#6c757d';
        }
    }

    // --- Core Logic ---

    function getAllowedVoices() {
        let allVoices = window.speechSynthesis.getVoices();
        if (!Array.isArray(allVoices)) return []; // Handle cases where getVoices might not return array
        return allVoices.filter(v => !state.blacklistedVoices.includes(v.name));
    }

    function isVoiceBlacklisted(voiceName) {
        return state.blacklistedVoices.includes(voiceName);
    }

    // Check current TTS users and switch them if their voice becomes blacklisted
    function applyVoiceBlacklist() {
        const allowedVoices = getAllowedVoices();
        const currentState = ttsManager.getTTSState(); // Get current users from ttsManager

        currentState.users.forEach((currentVoiceName, username) => {
            if (isVoiceBlacklisted(currentVoiceName)) {
                if (allowedVoices.length > 0) {
                    const newVoice = allowedVoices[Math.floor(Math.random() * allowedVoices.length)].name;
                    // Use ttsManager's function to update, which handles queue etc.
                    ttsManager.updateUserVoice(username, newVoice);
                    chatUI.addSystemMessage(`${username}'s voice "${currentVoiceName}" is blacklisted. Switched to "${newVoice}".`);
                } else {
                    // No allowed voices left! What to do?
                    // Option 1: Remove the user?
                    // ttsManager.removeTTSUser(username);
                    // chatUI.addSystemMessage(`Warning: ${username}'s blacklisted voice couldn't be changed (no allowed voices). User removed from TTS.`);
                    // Option 2: Leave them with blacklisted voice?
                    chatUI.addSystemMessage(`Warning: ${username}'s voice "${currentVoiceName}" is blacklisted, but no alternative allowed voices are available!`);
                }
            }
        });
    }

    // Find best matching voice for !pickvoice command
    function findMatchingVoice(query) {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) return null;

        const allowed = getAllowedVoices();
        if (!allowed.length) return null;

        // Prioritize exact match (case-insensitive)
        let match = allowed.find(v => v.name.toLowerCase() === lowerQuery);
        if (match) return match;

        // Prioritize startsWith match
        match = allowed.find(v => v.name.toLowerCase().startsWith(lowerQuery));
        if (match) return match;

        // Then prioritize includes match
        match = allowed.find(v => v.name.toLowerCase().includes(lowerQuery));
        if (match) return match;

        // Maybe add acronym matching or fuzzy matching later if needed

        return null; // No suitable match found
    }

    // --- Event Listeners ---
    function setupModalListeners() {
        if (voiceSettingsBtn) {
            voiceSettingsBtn.addEventListener('click', () => {
                loadVoiceSettings(); // Load latest state into modal
                if (voiceSettingsModal) voiceSettingsModal.style.display = 'block';
            });
        }

        if (saveVoiceSettingsBtn) {
            saveVoiceSettingsBtn.addEventListener('click', saveVoiceSettings);
        }

        if (closeVoiceSettingsBtn) {
            closeVoiceSettingsBtn.addEventListener('click', () => {
                // Add unsaved changes check?
                if (voiceSettingsModal) voiceSettingsModal.style.display = 'none';
            });
        }

        // Close on background click
        window.addEventListener('click', (e) => {
            if (voiceSettingsModal && e.target === voiceSettingsModal) {
                // Add unsaved changes check?
                voiceSettingsModal.style.display = 'none';
            }
        });
    }

    // --- Public API ---
    // Expose functions needed by other modules via window object
    window.voiceSettings = {
        loadVoiceSettings: loadVoiceSettings,
        applyVoiceBlacklist: applyVoiceBlacklist,
        getAllowedVoices: getAllowedVoices,
        isVoiceBlacklisted: isVoiceBlacklisted,
        findMatchingVoice: findMatchingVoice,
        isPickVoiceEnabled: () => state.pickVoiceEnabled,
        getPickVoiceTrigger: () => state.pickVoiceTrigger
    };

    // --- Initial Load ---
    document.addEventListener('DOMContentLoaded', () => {
        loadVoiceSettings(); // Load state on startup
        setupModalListeners();
        // Apply blacklist on initial load as well
        // Need to wait for voices to be ready? Add slight delay or use onvoiceschanged hook
        const checkVoicesAndApply = () => {
            if (window.speechSynthesis.getVoices().length > 0) {
                applyVoiceBlacklist();
            } else {
                setTimeout(checkVoicesAndApply, 200); // Check again shortly
            }
        };
        checkVoicesAndApply();
    });

})(); // End IIFE