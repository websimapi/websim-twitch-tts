import * as ttsManager from './ttsManager.js'; // Import ttsManager

// Keep IIFE for now as it defines window.getCustomCommand directly
(function() {
    const customCommandsKey = 'customCommands';
    let commands = [];
    // Define a chunk size for splitting large base64 strings (adjust as needed)
    const CHUNK_SIZE = 1000000; // 1 million characters per chunk

    // Load commands from localStorage
    function loadCommands() {
        const stored = localStorage.getItem(customCommandsKey);
        if (stored) {
            try {
                commands = JSON.parse(stored);
                // Ensure preloadedAudio is removed if it exists from previous sessions
                commands.forEach(cmd => delete cmd.preloadedAudio);
            } catch (e) {
                console.error('Error parsing custom commands from localStorage', e);
                commands = [];
            }
        } else {
            commands = []; // Ensure commands is an array if nothing is stored
        }
    }

    // Save commands to localStorage
    function saveCommands() {
         // Before saving, remove the non-serializable preloadedAudio objects
         const commandsToSave = commands.map(cmd => {
             const { preloadedAudio, ...rest } = cmd;
             return rest;
           });
        localStorage.setItem(customCommandsKey, JSON.stringify(commandsToSave));
    }

    // Expose function to get a command by trigger (exact match, case-insensitive)
    function getCustomCommand(trigger) {
         // Ensure commands is loaded
         if (!commands || commands.length === 0) {
             loadCommands(); // Load if not already loaded (e.g., on first call)
         }
        return commands.find(cmd => cmd.trigger.toLowerCase() === trigger.toLowerCase());
    }

    // Expose getCustomCommand globally so chat modules can use it
    window.getCustomCommand = getCustomCommand; // Still using window for simplicity here

    // Populate the Custom Commands Modal UI
    function populateCustomCommandsUI() {
        const listDiv = document.getElementById('custom-commands-list');
        if (!listDiv) return;
        listDiv.innerHTML = ''; // Clear previous content

        if (commands.length === 0) {
            listDiv.innerHTML = "<p style='font-size:1em; text-align:center; color:#666; margin:10px 0;'>No custom commands defined.</p>";
            return;
        }

        const voices = window.speechSynthesis.getVoices(); // Get voices once

        commands.forEach((cmd, index) => {
            const container = document.createElement('div');
            container.className = 'custom-command-item';
            // Removed inline styles, prefer CSS file

            // Trigger input
            const triggerInput = document.createElement('input');
            triggerInput.type = 'text';
            triggerInput.value = cmd.trigger;
            triggerInput.placeholder = 'Trigger (e.g., !hello)';
            triggerInput.className = 'command-trigger-input';
            triggerInput.addEventListener('input', (e) => {
                cmd.trigger = e.target.value;
                // No need to save on every input, save button handles it
            });
            container.appendChild(triggerInput);

            // Type select
            const typeSelect = document.createElement('select');
             typeSelect.className = 'command-type-select';
            typeSelect.innerHTML = `
                <option value="tts" ${cmd.type === 'tts' ? 'selected' : ''}>TTS</option>
                <option value="audio" ${cmd.type === 'audio' ? 'selected' : ''}>Audio</option>
            `;
            typeSelect.addEventListener('change', (e) => {
                cmd.type = e.target.value;
                updateCommandRowVisibility(container, cmd);
            });
            container.appendChild(typeSelect);

            // Details container
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'command-details-container';

            // TTS details
            const ttsContainer = document.createElement('div');
            ttsContainer.className = 'tts-details';
            ttsContainer.style.display = cmd.type === 'tts' ? 'flex' : 'none';

            const ttsMessageInput = document.createElement('input');
            ttsMessageInput.type = 'text';
            ttsMessageInput.placeholder = 'TTS Message';
            ttsMessageInput.value = cmd.message || '';
            ttsMessageInput.className = 'tts-message-input';
            ttsMessageInput.addEventListener('input', (e) => {
                cmd.message = e.target.value;
            });
            ttsContainer.appendChild(ttsMessageInput);

            const ttsVoiceSelect = document.createElement('select');
             ttsVoiceSelect.className = 'tts-voice-select';
             ttsVoiceSelect.dataset.purpose = "voice-select"; // Add marker for ttsManager updates
            if (!voices.length) {
                ttsVoiceSelect.innerHTML = `<option>Loading voices...</option>`;
            } else {
                ttsVoiceSelect.innerHTML = voices.map(voice => `<option value="${voice.name}" ${cmd.voice === voice.name ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
            }
            ttsVoiceSelect.addEventListener('change', (e) => {
                cmd.voice = e.target.value;
            });
            ttsContainer.appendChild(ttsVoiceSelect);

            // Audio details
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-details';
            audioContainer.style.display = cmd.type === 'audio' ? 'flex' : 'none';

            const audioLabel = document.createElement('span');
            audioLabel.className = 'audio-file-label';
            audioLabel.textContent = cmd.audioFileName ? cmd.audioFileName : (cmd.audioData ? 'File loaded' : 'No file');
            audioContainer.appendChild(audioLabel);

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/*';
             fileInput.className = 'audio-file-input';
            // Clear file input visually - doesn't work reliably across browsers
            // fileInput.value = ''; // Attempt to clear
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        const result = ev.target.result;
                        // Chunking logic remains
                        if(result.length > CHUNK_SIZE) {
                          let chunks = [];
                          for(let i = 0; i < result.length; i += CHUNK_SIZE) {
                            chunks.push(result.substring(i, i + CHUNK_SIZE));
                          }
                          cmd.audioData = chunks;
                        } else {
                          cmd.audioData = result;
                        }
                        cmd.audioFileName = file.name;
                        audioLabel.textContent = file.name;
                        // Preload audio immediately after loading
                        prepareSingleAudio(cmd);
                         // Visually clear the file input after processing
                         e.target.value = null;
                    };
                     reader.onerror = () => {
                        alert('Error reading audio file.');
                        e.target.value = null; // Clear on error too
                    };
                    reader.readAsDataURL(file);
                }
            });
            audioContainer.appendChild(fileInput);

            detailsDiv.appendChild(ttsContainer);
            detailsDiv.appendChild(audioContainer);
            container.appendChild(detailsDiv);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
             deleteBtn.className = 'delete-command-btn';
            deleteBtn.addEventListener('click', () => {
                commands.splice(index, 1);
                // No need to save here, let the main Save button do it
                populateCustomCommandsUI(); // Re-render the list
            });
            container.appendChild(deleteBtn);

            listDiv.appendChild(container);
        });
    }

    // Update visibility of TTS/Audio details
    function updateCommandRowVisibility(row, cmd) {
        const ttsDetails = row.querySelector('.tts-details');
        const audioDetails = row.querySelector('.audio-details');
        if (!ttsDetails || !audioDetails) return;

        if (cmd.type === 'tts') {
            ttsDetails.style.display = 'flex';
            audioDetails.style.display = 'none';
        } else { // 'audio'
            ttsDetails.style.display = 'none';
            audioDetails.style.display = 'flex';
        }
    }

    // Add a new blank custom command row to the UI
    function addNewCommand() {
         const voices = window.speechSynthesis.getVoices();
        commands.push({
            trigger: '',
            type: 'tts',
            message: '',
            voice: (voices[0] || {}).name || '', // Default to first available voice
            audioData: null, // Use null instead of ''
            audioFileName: null
        });
        populateCustomCommandsUI(); // Re-render UI
    }

    // Preload a single audio command
    function prepareSingleAudio(cmd) {
      if (cmd.type === 'audio' && cmd.audioData && !cmd.preloadedAudio) {
        try {
            const audioSrc = Array.isArray(cmd.audioData) ? cmd.audioData.join('') : cmd.audioData;
             if (!audioSrc.startsWith('data:audio')) {
                console.warn(`Invalid audio data for command ${cmd.trigger || 'new'}.`);
                return;
             }
            const audio = new Audio(audioSrc);
            // audio.load(); // Preloading happens automatically when src is set
            cmd.preloadedAudio = audio; // Store the Audio object
             console.log(`Preloaded audio for command: ${cmd.trigger || '(new)'}`);
        } catch (e) {
            console.error(`Error preloading audio for command ${cmd.trigger || 'new'}:`, e);
            // Clean up potentially bad data?
            // cmd.audioData = null;
            // cmd.audioFileName = null;
        }
      }
    }


    // Preload all audio files defined in commands
    function prepareCustomCommandAudioFiles() {
        if (!commands) return;
        console.log("Preparing custom command audio files...");
        commands.forEach(prepareSingleAudio);
    }

     // --- Event Listeners Setup ---
     function setupEventListeners() {
        const addBtn = document.getElementById('add-custom-command-btn');
        const saveBtn = document.getElementById('save-custom-commands');
        const closeBtn = document.getElementById('close-custom-commands');
        const openBtn = document.getElementById('custom-commands-btn');
        const modal = document.getElementById('custom-commands-modal');

        if (addBtn) addBtn.addEventListener('click', addNewCommand);

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent potential form submission
                saveCommands();
                prepareCustomCommandAudioFiles(); // Re-prepare in case new files were added
                alert('Custom commands saved.');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                 // Add logic here to check for unsaved changes if desired
                if (modal) modal.style.display = 'none';
            });
        }

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                 loadCommands(); // Ensure latest commands are loaded from storage
                 populateCustomCommandsUI(); // Populate with loaded data
                 // Voices might have loaded since last open, ensure selects are up-to-date
                 const voices = window.speechSynthesis.getVoices();
                 modal.querySelectorAll('.tts-voice-select').forEach(select => {
                     const currentVal = select.value;
                     select.innerHTML = voices.map(voice => `<option value="${voice.name}" ${currentVal === voice.name ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
                 });
                 if (modal) modal.style.display = 'block';
            });
        }

        // Close modal on background click
        window.addEventListener('click', (e) => {
            if (modal && e.target === modal) {
                modal.style.display = 'none';
            }
        });
     }


     // --- Exports for other modules ---
     // Use window object for now for simplicity, could be refactored later
     window.refreshCustomCommandsUI = populateCustomCommandsUI;
     window.loadCustomCommands = loadCommands;
     window.prepareCustomCommandAudioFiles = prepareCustomCommandAudioFiles;
     // getCustomCommand is already on window

    // --- Initial Load ---
    document.addEventListener('DOMContentLoaded', () => {
        loadCommands();
        prepareCustomCommandAudioFiles(); // Prepare on initial load
        setupEventListeners(); // Set up listeners after DOM is ready
        // Don't populate UI until button is clicked
    });

    // Make functions available via module pattern as well if needed elsewhere via import
     window.customCommands = { // Keep window export for now
       loadCustomCommands: loadCommands,
       saveCustomCommands: saveCommands,
       getCustomCommand: getCustomCommand,
       refreshCustomCommandsUI: populateCustomCommandsUI,
       prepareCustomCommandAudioFiles: prepareCustomCommandAudioFiles,
     };

})(); // End IIFE