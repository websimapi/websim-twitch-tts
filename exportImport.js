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

  // Import settings from an uploaded file
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
        alert('Settings imported successfully. Please reload the page for changes to take effect.');
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