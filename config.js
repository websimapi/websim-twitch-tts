// Default configuration values
// These can be overridden by values stored in localStorage

export const DEFAULT_SETTINGS = {
    // TTS Settings
    ttsEnabled: true,
    ttsFilterEnabled: true,
    autoAddUserEnabled: true,
    ttsUsers: [], // Stored as JSON string map in localStorage

    // Gamble Settings
    gambleEnabled: true,
    gambleCooldown: 0,
    gambleTriggers: ["!gamblevoice", "!gv", "bonesd3TC"], // Stored as JSON string array

    // Mute Settings
    allowSelfMute: true,
    selfUnmuteCommands: '!tts, !tts-on, !unmute, bonesd3TS', // Stored as string
    selfMuteCommands: '!tts-off, !mute, bonesd3TO', // Stored as string

    // Voice Settings
    pickVoiceEnabled: true,
    blacklistedVoices: [], // Stored as JSON string array

    // Image Generation Settings
    imageGenEnabled: true,
    imageGenCooldown: 30, // seconds
    imageGenTrigger: '!image', // Stored as string
    imageGenMaxGallery: 20, // Max number of images stored

    // Custom Commands
    customCommands: [], // Stored as JSON string array

    // Scheduled Events
    scheduledEvents: [], // Stored as JSON string array

    // Gallery
    imageGallery: [], // Stored as JSON string array of {prompt, url, timestamp, user}
};

// Helper to get a setting from localStorage or return default
export function getSetting(key) {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) {
        // Attempt to parse if it looks like JSON
        if ((storedValue.startsWith('[') && storedValue.endsWith(']')) || (storedValue.startsWith('{') && storedValue.endsWith('}'))) {
            try {
                return JSON.parse(storedValue);
            } catch (e) {
                console.warn(`Failed to parse localStorage key "${key}", returning raw value.`);
                return storedValue; // Return raw string if parsing fails
            }
        }
        // Handle boolean strings
        if (storedValue === 'true') return true;
        if (storedValue === 'false') return false;
        // Handle numbers
        if (!isNaN(storedValue) && storedValue.trim() !== '') return Number(storedValue);

        return storedValue; // Return raw string value
    }
    return DEFAULT_SETTINGS[key];
}

export function setSetting(key, value) {
     if (typeof value === 'object') {
         localStorage.setItem(key, JSON.stringify(value));
     } else {
         localStorage.setItem(key, String(value));
     }
}