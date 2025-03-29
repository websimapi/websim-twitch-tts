import * as chatUI from './chatUI.js';
import * as config from 'config';

const settings = {
    enabled: config.getSetting('imageGenEnabled'),
    cooldown: config.getSetting('imageGenCooldown'),
    trigger: config.getSetting('imageGenTrigger'),
    maxGallery: config.getSetting('imageGenMaxGallery')
};

const lastUse = new Map(); // Stores last usage timestamp per user
const galleryKey = 'imageGallery';

const settingsBtn = document.getElementById('image-gen-settings-btn');
const settingsModal = document.getElementById('image-gen-settings-modal');
const enabledCheckbox = document.getElementById('image-gen-enabled');
const cooldownInput = document.getElementById('image-gen-cooldown');
const triggerInput = document.getElementById('image-gen-trigger');
const maxGalleryInput = document.getElementById('image-gen-max');
const saveBtn = document.getElementById('save-image-gen-settings');
const unsavedWarning = document.getElementById('image-gen-unsaved-warning');

let initialSettings = {};
let unsavedPrompted = false;

function updateSettingsButton() {
    if (!settingsBtn) return;
    if (settings.enabled) {
        settingsBtn.classList.remove('off');
        settingsBtn.style.backgroundColor = '';
    } else {
        settingsBtn.classList.add('off');
        settingsBtn.style.backgroundColor = '#6c757d';
    }
}

function loadSettingsIntoModal() {
    enabledCheckbox.checked = settings.enabled;
    cooldownInput.value = settings.cooldown;
    triggerInput.value = settings.trigger;
    maxGalleryInput.value = settings.maxGallery;

    initialSettings = {
        enabled: enabledCheckbox.checked,
        cooldown: cooldownInput.value,
        trigger: triggerInput.value,
        maxGallery: maxGalleryInput.value
    };
    unsavedPrompted = false;
    unsavedWarning.style.display = 'none';
}

function hasUnsavedChanges() {
    return (
        enabledCheckbox.checked !== initialSettings.enabled ||
        cooldownInput.value !== initialSettings.cooldown ||
        triggerInput.value !== initialSettings.trigger ||
        maxGalleryInput.value !== initialSettings.maxGallery
    );
}

function saveSettingsFromModal() {
    settings.enabled = enabledCheckbox.checked;
    settings.cooldown = parseInt(cooldownInput.value, 10) || 0;
    settings.trigger = triggerInput.value.trim().toLowerCase() || '!image';
    settings.maxGallery = parseInt(maxGalleryInput.value, 10) || 20;

    config.setSetting('imageGenEnabled', settings.enabled);
    config.setSetting('imageGenCooldown', settings.cooldown);
    config.setSetting('imageGenTrigger', settings.trigger);
    config.setSetting('imageGenMaxGallery', settings.maxGallery);

    updateSettingsButton();
    settingsModal.style.display = 'none';
    trimGallery(); // Trim gallery if max size decreased
}

function trimGallery() {
    let gallery = config.getSetting('imageGallery');
    if (gallery.length > settings.maxGallery) {
        gallery = gallery.slice(-settings.maxGallery); // Keep the newest entries
        config.setSetting('imageGallery', gallery);
        if (window.galleryDisplay) {
             window.galleryDisplay.loadGallery(); // Refresh display
        }
    }
}

function addImageToGallery(user, prompt, url) {
    let gallery = config.getSetting('imageGallery');
    gallery.push({ user, prompt, url, timestamp: Date.now() });
    // Trim gallery if it exceeds max size
    if (gallery.length > settings.maxGallery) {
        gallery = gallery.slice(-settings.maxGallery); // Keep the newest entries
    }
    config.setSetting('imageGallery', gallery);
     if (window.galleryDisplay) {
          window.galleryDisplay.addImageToDisplay({ user, prompt, url, timestamp: Date.now() }); // Add directly to display
     }
}

function isOnCooldown(username) {
    if (settings.cooldown <= 0) return false;
    const last = lastUse.get(username.toLowerCase());
    if (!last) return false;
    const timeSince = Date.now() - last;
    return timeSince < (settings.cooldown * 1000);
}

async function handleImageCommand(username, prompt) {
    if (!settings.enabled) {
        // Silently ignore if disabled, or add a system message if preferred
        // chatUI.addSystemMessage("Image generation command is disabled.");
        return;
    }

    if (isOnCooldown(username)) {
        const last = lastUse.get(username.toLowerCase());
        const remaining = Math.ceil((settings.cooldown * 1000 - (Date.now() - last)) / 1000);
        chatUI.addSystemMessage(`${username} must wait ${remaining}s before generating another image.`);
        return;
    }

    if (!prompt || prompt.trim().length === 0) {
        chatUI.addSystemMessage(`Usage: ${settings.trigger} <your image prompt>`);
        return;
    }

    chatUI.addSystemMessage(`${username} is generating an image for prompt: "${prompt}"...`);
    lastUse.set(username.toLowerCase(), Date.now()); // Set cooldown start

    try {
        // Default aspect ratio or make configurable later
        const result = await websim.imageGen({ prompt: prompt, aspect_ratio: "1:1" });

        if (result && result.url) {
            addImageToGallery(username, prompt, result.url);
            chatUI.addSystemMessage(`Image generated for ${username}! Check the gallery.`);
         // Optionally display link in chat:
         // chatUI.addSystemMessage(`Image link for "${prompt}": ${result.url}`);
        } else {
            chatUI.addSystemMessage(`Image generation failed for ${username}. No URL received.`);
            lastUse.delete(username.toLowerCase()); // Remove cooldown on failure
        }
    } catch (error) {
        console.error("Image generation error:", error);
        chatUI.addSystemMessage(`Image generation failed for ${username}. Error: ${error.message}`);
        lastUse.delete(username.toLowerCase()); // Remove cooldown on error
    }
}

// --- Event Listeners ---
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        loadSettingsIntoModal();
        settingsModal.style.display = 'block';
    });
}

if (saveBtn) {
    saveBtn.addEventListener('click', saveSettingsFromModal);
}

// Enhanced modal close behavior
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        if (hasUnsavedChanges()) {
            if (!unsavedPrompted) {
                unsavedWarning.textContent = "You have unsaved changes. Click outside again to cancel.";
                unsavedWarning.style.display = 'block';
                unsavedPrompted = true;
            } else {
                // Revert changes by reloading modal state
                loadSettingsIntoModal(); // Reloads from current settings, effectively discarding changes
                unsavedWarning.style.display = 'none';
                unsavedPrompted = false;
                settingsModal.style.display = 'none';
            }
        } else {
            settingsModal.style.display = 'none';
        }
    }
});

// Close button inside modal (if one exists, standard pattern)
const closeBtn = settingsModal ? settingsModal.querySelector('.close-btn') : null; // Assuming a common close button class
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
         if (hasUnsavedChanges()) {
              // Ask for confirmation or just revert
              loadSettingsIntoModal(); // Reloads from current settings, effectively discarding changes
              unsavedWarning.style.display = 'none';
              unsavedPrompted = false;
         }
         settingsModal.style.display = 'none';
    });
}


// --- Exports ---
export function loadImageGenSettings() {
    settings.enabled = config.getSetting('imageGenEnabled');
    settings.cooldown = config.getSetting('imageGenCooldown');
    settings.trigger = config.getSetting('imageGenTrigger');
    settings.maxGallery = config.getSetting('imageGenMaxGallery');
    updateSettingsButton();
    // Optionally load into modal if it might be open? Unlikely needed here.
    // loadSettingsIntoModal();
}

export function getCommandTrigger() {
    return settings.trigger;
}

export { handleImageCommand };

// Initial load
loadImageGenSettings();