import * as ttsManager from './ttsManager.js';
import * as chatUI from './chatUI.js';
import * as customCommands from './customCommands.js';
import * as imageGenManager from './imageGenManager.js';
import * as galleryDisplay from './galleryDisplay.js';
import * as gambleManager from './gambleManager.js'; 
import * as muteSettings from './muteSettings.js'; 
import * as voiceSettings from './voiceSettings.js'; 
import * as scheduledEvents from './scheduledEvents.js'; 

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

    // Reload all relevant UI elements after import
    function reloadAllSettingsUI() {
         // TTS Settings
         ttsManager.loadTTSState(); 

         // Gamble Settings
         gambleManager.loadGambleSettings(); 
         gambleManager.loadGambleSettingsIntoModal(); 

         // Image Gen Settings
         imageGenManager.loadImageGenSettings(); 

         // Mute Settings
         muteSettings.loadMuteSettings(); 
         muteSettings.updateMuteSettingsButton();

         // Voice Settings
         voiceSettings.loadVoiceSettings(); 
         voiceSettings.applyVoiceBlacklist(); 
         voiceSettings.updateVoiceSettingsButton();

         // Custom Commands
         customCommands.loadCustomCommands(); 
         customCommands.refreshCustomCommandsUI(); 
         customCommands.prepareCustomCommandAudioFiles(); 

         // Scheduled Events
         scheduledEvents.load(); 
         scheduledEvents.populateUI(); 

         // Gallery Display
         if (galleryDisplay && galleryDisplay.loadGallery) {
            galleryDisplay.loadGallery(); 
         }

         // Auto Add User Toggle 
        const autoAddUserToggle = document.getElementById('auto-add-user-toggle');
        if (autoAddUserToggle) {
          let autoAddUserEnabled = localStorage.getItem('autoAddUserEnabled');
           autoAddUserEnabled = !(autoAddUserEnabled === 'false');
          autoAddUserToggle.textContent = autoAddUserEnabled ? 'Auto Add User: On' : 'Auto Add User: Off';
          autoAddUserToggle.classList.toggle('off', !autoAddUserEnabled);
        }

         // Inform user
         alert('Settings imported successfully. UI updated.');
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
                         if (key === 'imageGallery' && typeof imported[key] === 'string' && imported[key].length > 5 * 1024 * 1024) {
                            console.warn("Skipping import of large imageGallery data (over 5MB).");
                            alert("Warning: Image gallery data was too large and was skipped during import.");
                            continue;
                         }
                        localStorage.setItem(key, imported[key]);
                    }
                }

                // Reload UI elements based on newly imported settings
                reloadAllSettingsUI();

                // Reset the file input so the same file can be imported again if needed
                event.target.value = null;

            } catch (err) {
                alert(`Failed to import settings: ${err.message}`);
                console.error("Import Error:", err);
                 // Reset the file input on error too
                event.target.value = null;
            }
        };
        reader.onerror = function() {
            alert('Failed to read the settings file.');
             // Reset the file input on error
             event.target.value = null;
        };
        reader.readAsText(file);
    }

    function setupExportImportModal() {
        const openBtn = document.getElementById('export-import-settings-btn');
        const modal = document.getElementById('export-import-modal');
        const closeBtn = document.getElementById('close-export-import-btn');
        const exportBtn = document.getElementById('download-export-btn');
        const importFileInput = document.getElementById('import-settings-file');

        if (!openBtn || !modal || !closeBtn || !exportBtn || !importFileInput) {
            console.warn("Export/Import UI elements not found.");
            return;
        }

        openBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
             // Reset file input when closing modal manually
             importFileInput.value = null;
        });

        // Clicking outside modal-content closes modal
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                 // Reset file input when closing modal via background click
                 importFileInput.value = null;
            }
        });

        exportBtn.addEventListener('click', exportSettingsDownload);
        importFileInput.addEventListener('change', importSettingsFromFile);
    }

    document.addEventListener('DOMContentLoaded', setupExportImportModal);

})();