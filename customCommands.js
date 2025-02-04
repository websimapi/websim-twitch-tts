// Custom Commands Module
// This module allows users to configure custom commands that trigger either a TTS message (with a specified voice)
// or play an uploaded audio file. The commands are stored in localStorage under the key "customCommands".

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
      } catch (e) {
        console.error('Error parsing custom commands from localStorage', e);
        commands = [];
      }
    }
  }

  // Save commands to localStorage
  function saveCommands() {
    localStorage.setItem(customCommandsKey, JSON.stringify(commands));
  }

  // Expose function to get a command by trigger (exact match, case-insensitive)
  function getCustomCommand(trigger) {
    return commands.find(cmd => cmd.trigger.toLowerCase() === trigger.toLowerCase());
  }

  // Expose getCustomCommand globally so chat.js can use it
  window.getCustomCommand = getCustomCommand;

  // Populate the Custom Commands Modal UI with a more compact and user-friendly layout.
  function populateCustomCommandsUI() {
    const listDiv = document.getElementById('custom-commands-list');
    listDiv.innerHTML = '';

    if (commands.length === 0) {
      listDiv.innerHTML = "<p style='font-size:1em; text-align:center; color:#666; margin:10px 0;'>No custom commands defined.</p>";
      return;
    }

    commands.forEach((cmd, index) => {
      const container = document.createElement('div');
      container.className = 'custom-command-item';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.flexWrap = 'wrap';
      container.style.gap = '8px';
      container.style.marginBottom = '8px';
      container.style.padding = '8px';
      container.style.border = '1px solid #ccc';
      container.style.borderRadius = '4px';
      container.style.background = '#fafafa';

      // Trigger input
      const triggerInput = document.createElement('input');
      triggerInput.type = 'text';
      triggerInput.value = cmd.trigger;
      triggerInput.placeholder = 'Trigger (e.g., !hello)';
      triggerInput.style.fontSize = '0.9em';
      triggerInput.style.padding = '4px';
      triggerInput.style.width = '100px';
      triggerInput.addEventListener('input', (e) => {
        cmd.trigger = e.target.value;
      });
      container.appendChild(triggerInput);

      // Type select
      const typeSelect = document.createElement('select');
      typeSelect.style.fontSize = '0.9em';
      typeSelect.style.padding = '4px';
      typeSelect.style.width = '100px';
      typeSelect.innerHTML = `
        <option value="tts" ${cmd.type === 'tts' ? 'selected' : ''}>TTS</option>
        <option value="audio" ${cmd.type === 'audio' ? 'selected' : ''}>Audio</option>
      `;
      typeSelect.addEventListener('change', (e) => {
        cmd.type = e.target.value;
        updateCommandRowVisibility(container, cmd);
      });
      container.appendChild(typeSelect);

      // Details container (flex container for TTS or Audio details)
      const detailsDiv = document.createElement('div');
      detailsDiv.style.display = 'flex';
      detailsDiv.style.alignItems = 'center';
      detailsDiv.style.gap = '8px';
      detailsDiv.style.flexGrow = '1';

      // TTS details: message input and voice select
      const ttsContainer = document.createElement('div');
      ttsContainer.className = 'tts-details';
      ttsContainer.style.display = cmd.type === 'tts' ? 'flex' : 'none';
      ttsContainer.style.alignItems = 'center';
      ttsContainer.style.gap = '4px';
      ttsContainer.style.flexGrow = '1';

      const ttsMessageInput = document.createElement('input');
      ttsMessageInput.type = 'text';
      ttsMessageInput.placeholder = 'TTS Message';
      ttsMessageInput.value = cmd.message || '';
      ttsMessageInput.style.fontSize = '0.9em';
      ttsMessageInput.style.padding = '4px';
      ttsMessageInput.style.flexGrow = '1';
      ttsMessageInput.addEventListener('input', (e) => {
        cmd.message = e.target.value;
      });
      ttsContainer.appendChild(ttsMessageInput);

      const ttsVoiceSelect = document.createElement('select');
      ttsVoiceSelect.style.fontSize = '0.9em';
      ttsVoiceSelect.style.padding = '4px';
      // Populate voices from window.speechSynthesis if available
      let voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        ttsVoiceSelect.innerHTML = `<option>Loading voices...</option>`;
      } else {
        ttsVoiceSelect.innerHTML = voices.map(voice => `<option value="${voice.name}" ${cmd.voice === voice.name ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
      }
      ttsVoiceSelect.addEventListener('change', (e) => {
        cmd.voice = e.target.value;
      });
      ttsContainer.appendChild(ttsVoiceSelect);

      // Audio details: file input and status label
      const audioContainer = document.createElement('div');
      audioContainer.className = 'audio-details';
      audioContainer.style.display = cmd.type === 'audio' ? 'flex' : 'none';
      audioContainer.style.alignItems = 'center';
      audioContainer.style.gap = '4px';
      audioContainer.style.flexGrow = '1';

      const audioLabel = document.createElement('span');
      audioLabel.style.fontSize = '0.9em';
      // Show current file name if available, otherwise default message
      audioLabel.textContent = cmd.audioFileName ? cmd.audioFileName : (cmd.audioData ? 'File loaded' : 'No file');
      audioContainer.appendChild(audioLabel);

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*';
      fileInput.style.fontSize = '0.9em';
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(ev) {
            const result = ev.target.result;
            // If the base64 string is too large, split it into chunks
            if(result.length > CHUNK_SIZE) {
              let chunks = [];
              for(let i = 0; i < result.length; i += CHUNK_SIZE) {
                chunks.push(result.substring(i, i + CHUNK_SIZE));
              }
              cmd.audioData = chunks;
            } else {
              cmd.audioData = result;
            }
            // Store the file name for display purposes
            cmd.audioFileName = file.name;
            audioLabel.textContent = file.name;
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
      deleteBtn.style.fontSize = '0.9em';
      deleteBtn.style.padding = '4px 8px';
      deleteBtn.style.background = '#dc3545';
      deleteBtn.style.color = '#fff';
      deleteBtn.style.border = 'none';
      deleteBtn.style.borderRadius = '4px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.addEventListener('click', () => {
        commands.splice(index, 1);
        saveCommands();
        populateCustomCommandsUI();
      });
      container.appendChild(deleteBtn);

      listDiv.appendChild(container);
    });
  }

  // Update which details are visible based on the command type.
  function updateCommandRowVisibility(row, cmd) {
    const ttsDetails = row.querySelector('.tts-details');
    const audioDetails = row.querySelector('.audio-details');
    if (cmd.type === 'tts') {
      ttsDetails.style.display = 'flex';
      audioDetails.style.display = 'none';
    } else {
      ttsDetails.style.display = 'none';
      audioDetails.style.display = 'flex';
    }
  }

  // Add a new custom command row
  function addNewCommand() {
    commands.push({
      trigger: '',
      type: 'tts',
      message: '',
      voice: (window.speechSynthesis.getVoices()[0] || {}).name || '',
      audioData: '',
      audioFileName: ''
    });
    populateCustomCommandsUI();
  }

  // Event listeners for modal controls
  document.getElementById('add-custom-command-btn').addEventListener('click', () => {
    addNewCommand();
  });

  document.getElementById('save-custom-commands').addEventListener('click', () => {
    saveCommands();
    alert('Custom commands saved.');
  });

  // Initialize modal UI when the modal is opened
  const customModal = document.getElementById('custom-commands-modal');
  customModal.addEventListener('click', (e) => {
    // Prevent propagation if clicking inside modal-content
    if (e.target.closest('.modal-content')) return;
    customModal.style.display = 'none';
  });

  // When voices are loaded, populate the UI (voices might be loaded asynchronously)
  window.speechSynthesis.onvoiceschanged = () => {
    populateCustomCommandsUI();
  };

  // Initial load
  loadCommands();
  populateCustomCommandsUI();

  // Expose a manual refresh function if needed
  window.refreshCustomCommandsUI = populateCustomCommandsUI;
  // Expose loadCommands so that imported settings update custom commands in memory.
  window.loadCustomCommands = loadCommands;
})();