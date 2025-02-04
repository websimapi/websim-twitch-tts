(function() {
  // Helper: Get all localStorage settings as an object
  function getAllSettings() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      settings[key] = localStorage.getItem(key);
    }
    return settings;
  }
  
  // Trigger download of settings as a JSON file
  function exportSettingsDownload() {
    const settings = getAllSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "settings.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Import settings from an uploaded file and update UI immediately
  function importSettingsFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const imported = JSON.parse(e.target.result);
        for (const key in imported) {
          if (imported.hasOwnProperty(key)) {
            localStorage.setItem(key, imported[key]);
          }
        }
        // Immediately update the UI elements that depend on settings
        if(window.reloadChatSettings) {
          window.reloadChatSettings();
        }
        // Update Gamble Settings Modal fields
        const gambleCooldownInput = document.getElementById('gamble-cooldown');
        if(gambleCooldownInput) {
          gambleCooldownInput.value = localStorage.getItem('gambleCooldown') || 0;
        }
        const gambleEnabledCheckbox = document.getElementById('gamble-enabled');
        if(gambleEnabledCheckbox) {
          gambleEnabledCheckbox.checked = localStorage.getItem('gambleEnabled') === 'true';
        }
        const gambleTriggersInput = document.getElementById('gamble-triggers');
        if(gambleTriggersInput) {
          let triggers = localStorage.getItem('gambleTriggers');
          try {
            triggers = JSON.parse(triggers);
          } catch (err) {
            triggers = [];
          }
          gambleTriggersInput.value = triggers.join(', ');
        }
        // Update Auto Add User Toggle
        const autoAddUserToggle = document.getElementById('auto-add-user-toggle');
        if(autoAddUserToggle) {
          let autoAddUserEnabled = localStorage.getItem('autoAddUserEnabled');
          autoAddUserEnabled = autoAddUserEnabled === null ? true : autoAddUserEnabled === 'true';
          autoAddUserToggle.textContent = autoAddUserEnabled ? 'Auto Add User: On' : 'Auto Add User: Off';
        }
        // Update Custom Commands UI if available
        if(window.refreshCustomCommandsUI) {
          window.refreshCustomCommandsUI();
        }
        alert('Settings imported successfully.');
      } catch (err) {
        alert('Failed to import settings: Invalid JSON.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  function setupExportImportModal() {
    const openBtn = document.getElementById('export-import-settings-btn');
    const modal = document.getElementById('export-import-modal');
    const closeBtn = document.getElementById('close-export-import-btn');
    const exportBtn = document.getElementById('download-export-btn');
    const importFileInput = document.getElementById('import-settings-file');

    openBtn.addEventListener('click', () => {
      modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Clicking outside modal-content closes modal
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    exportBtn.addEventListener('click', exportSettingsDownload);
    importFileInput.addEventListener('change', importSettingsFromFile);
  }

  document.addEventListener('DOMContentLoaded', setupExportImportModal);
})();