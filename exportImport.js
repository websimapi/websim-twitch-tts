// exportImport.js
// This module adds export/import functionality for settings stored in localStorage.
// It allows the user to export all localStorage settings as JSON, and to import settings from a JSON file/string.

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

  // Populate the export textarea with the JSON of settings.
  function populateExportTextarea() {
    const exportTextarea = document.getElementById('export-settings-textarea');
    const settings = getAllSettings();
    exportTextarea.value = JSON.stringify(settings, null, 2);
  }

  // Copy export textarea contents to clipboard.
  function copyExportedSettings() {
    const exportTextarea = document.getElementById('export-settings-textarea');
    exportTextarea.select();
    document.execCommand('copy');
    alert('Settings copied to clipboard.');
  }

  // Import settings from the import textarea. Overwrites current localStorage keys.
  function importSettings() {
    const importTextarea = document.getElementById('import-settings-textarea');
    try {
      const imported = JSON.parse(importTextarea.value);
      for (const key in imported) {
        if (imported.hasOwnProperty(key)) {
          localStorage.setItem(key, imported[key]);
        }
      }
      alert('Settings imported successfully. Please reload the page for changes to take effect.');
    } catch (err) {
      alert('Failed to import settings: Invalid JSON.');
      console.error(err);
    }
  }

  // Setup event listeners for export/import modal
  function setupExportImportModal() {
    const openBtn = document.getElementById('export-import-settings-btn');
    const modal = document.getElementById('export-import-modal');
    const closeBtn = document.getElementById('close-export-import-btn');
    const copyBtn = document.getElementById('copy-export-btn');
    const importBtn = document.getElementById('import-settings-btn');

    openBtn.addEventListener('click', () => {
      populateExportTextarea();
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

    copyBtn.addEventListener('click', copyExportedSettings);
    importBtn.addEventListener('click', importSettings);
  }

  // Initialize export/import functionality when DOM is ready.
  document.addEventListener('DOMContentLoaded', setupExportImportModal);
})();