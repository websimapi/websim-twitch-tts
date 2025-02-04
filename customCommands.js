// Custom Commands Module
// This module allows users to configure custom commands that trigger either a TTS message (with a specified voice)
// or play an uploaded audio file. The commands are stored in localStorage under the key "customCommands".

(function() {
  const customCommandsKey = 'customCommands';
  let commands = [];

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

  // Populate the Custom Commands Modal UI
  function populateCustomCommandsUI() {
    const listDiv = document.getElementById('custom-commands-list');
    listDiv.innerHTML = '';

    if (commands.length === 0) {
      listDiv.innerHTML = "<p style='font-size:1.2em; text-align:center; color:#666; margin:20px 0;'>No custom commands defined.</p>";
      return;
    }

    commands.forEach((cmd, index) => {
      // Create a wrapper div with enhanced styling for better spacing and readability
      const container = document.createElement('div');
      container.className = 'custom-command-item';
      container.style.display = 'grid';
      container.style.gridTemplateColumns = '2fr 2fr 2fr auto';
      container.style.gap = '15px';
      container.style.alignItems = 'center';
      container.style.marginBottom = '15px';
      container.style.padding = '15px';
      container.style.border = '1px solid #ddd';
      container.style.borderRadius = '6px';
      container.style.background = '#f9f9f9';

      // Trigger input
      const triggerInput = document.createElement('input');
      triggerInput.type = 'text';
      triggerInput.value = cmd.trigger;
      triggerInput.placeholder = 'Command Trigger (e.g., !hello)';
      triggerInput.style.fontSize = '1.1em';
      triggerInput.style.padding = '10px';
      triggerInput.style.width = '100%';
      triggerInput.addEventListener('input', (e) => {
        cmd.trigger = e.target.value;
      });
      container.appendChild(triggerInput);

      // Type select
      const typeSelect = document.createElement('select');
      typeSelect.style.fontSize = '1.1em';
      typeSelect.style.padding = '10px';
      typeSelect.innerHTML = `
        <option value="tts" ${cmd.type === 'tts' ? 'selected' : ''}>TTS Message</option>
        <option value="audio" ${cmd.type === 'audio' ? 'selected' : ''}>Audio File</option>
      `;
      typeSelect.addEventListener('change', (e) => {
        cmd.type = e.target.value;
        updateCommandRowVisibility(container, cmd);
      });
      container.appendChild(typeSelect);

      // Details container: Will hold TTS details and Audio details stacked vertically
      const detailsDiv = document.createElement('div');
      detailsDiv.style.display = 'flex';
      detailsDiv.style.flexDirection = 'column';
      detailsDiv.style.gap = '10px';
      detailsDiv.style.width = '100%';

      // Container for TTS details
      const ttsContainer = document.createElement('div');
      ttsContainer.className = 'tts-details';
      ttsContainer.style.display = 'block';
      ttsContainer.style.width = '100%';

      // TTS message textarea
      const ttsMessage = document.createElement('textarea');
      ttsMessage.placeholder = 'TTS Message to speak';
      ttsMessage.value = cmd.message || '';
      ttsMessage.style.fontSize = '1.1em';
      ttsMessage.style.padding = '10px';
      ttsMessage.style.width = '100%';
      ttsMessage.style.minHeight = '50px';
      ttsMessage.addEventListener('input', (e) => {
        cmd.message = e.target.value;
      });
      ttsContainer.appendChild(ttsMessage);

      // TTS voice select
      const ttsVoiceSelect = document.createElement('select');
      ttsVoiceSelect.style.fontSize = '1.1em';
      ttsVoiceSelect.style.padding = '10px';
      // Populate voices from window.speechSynthesis if available
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      ttsVoiceSelect.innerHTML = voices.map(voice => `<option value="${voice.name}" ${cmd.voice === voice.name ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
      ttsVoiceSelect.addEventListener('change', (e) => {
        cmd.voice = e.target.value;
      });
      ttsContainer.appendChild(ttsVoiceSelect);

      // Container for Audio details
      const audioContainer = document.createElement('div');
      audioContainer.className = 'audio-details';
      audioContainer.style.display = 'none';
      audioContainer.style.width = '100%';
      // Label for audio file
      const audioLabel = document.createElement('p');
      audioLabel.style.fontSize = '1.1em';
      audioLabel.style.margin = '0';
      audioLabel.textContent = cmd.audioData ? 'Audio file loaded.' : 'No audio file selected.';
      audioContainer.appendChild(audioLabel);
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*';
      fileInput.style.fontSize = '1.1em';
      fileInput.style.padding = '10px';
      fileInput.style.width = '100%';
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(ev) {
            cmd.audioData = ev.target.result;
            audioLabel.textContent = 'Audio file loaded.';
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
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.fontSize = '1.1em';
      deleteBtn.style.padding = '10px 15px';
      deleteBtn.style.background = '#dc3545';
      deleteBtn.style.color = 'white';
      deleteBtn.style.border = 'none';
      deleteBtn.style.borderRadius = '4px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.addEventListener('click', () => {
        commands.splice(index, 1);
        saveCommands();
        populateCustomCommandsUI();
      });
      container.appendChild(deleteBtn);

      updateCommandRowVisibility(container, cmd);
      listDiv.appendChild(container);
    });
  }

  // Update which part of the command row is visible based on type
  function updateCommandRowVisibility(row, cmd) {
    const ttsDetails = row.querySelector('.tts-details');
    const audioDetails = row.querySelector('.audio-details');
    if (cmd.type === 'tts') {
      ttsDetails.style.display = 'block';
      audioDetails.style.display = 'none';
    } else {
      ttsDetails.style.display = 'none';
      audioDetails.style.display = 'block';
    }
  }

  // Add a new custom command row
  function addNewCommand() {
    commands.push({
      trigger: '',
      type: 'tts',
      message: '',
      voice: (window.speechSynthesis.getVoices()[0] || {}).name || '',
      audioData: ''
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

  // When the window loads, load voices then populate the UI (voices might be loaded asynchronously)
  window.speechSynthesis.onvoiceschanged = () => {
    populateCustomCommandsUI();
  };

  // Initial load
  loadCommands();
  populateCustomCommandsUI();

  // Expose a manual refresh function if needed
  window.refreshCustomCommandsUI = populateCustomCommandsUI;
})();