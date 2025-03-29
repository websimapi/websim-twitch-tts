import * as chatUI from './chatUI.js';
import * as ttsManager from './ttsManager.js';
import * as gambleManager from './gambleManager.js';
import * as imageGenManager from './imageGenManager.js';
import * as config from 'config';
import * as customCommands from './customCommands.js';
import * as muteSettings from './muteSettings.js';
import * as voiceSettings from './voiceSettings.js';
import * as galleryDisplay from './galleryDisplay.js'; 
import * as scheduledEvents from './scheduledEvents.js'; 

(function() {
    const channelInput = document.getElementById('channel-input');
    const connectButton = document.getElementById('connect-btn');
    const statusDiv = document.getElementById('status');
    let client = null;

    connectButton.addEventListener('click', function() {
        if (client && client.readyState() === 'OPEN') {
            disconnectFromChat();
        } else {
            connectToChat();
        }
    });

    channelInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            connectButton.click();
        }
    });

    function connectToChat() {
        const channel = channelInput.value.toLowerCase().trim();
        if (!channel) {
            alert('Please enter a channel name');
            return;
        }
        localStorage.setItem('lastConnectedChannel', channel);
        client = new window.tmi.Client({
            connection: {
                secure: true,
                reconnect: true
            },
            channels: [channel]
        });
        client.connect().catch(console.error);
        client.on('connected', function() {
            statusDiv.className = 'status connected';
            statusDiv.textContent = `Connected to ${channel}'s chat`;
            connectButton.textContent = 'Disconnect';
        });
        client.on('disconnected', function() {
            statusDiv.className = 'status disconnected';
            statusDiv.textContent = 'Disconnected from chat';
            connectButton.textContent = 'Connect';
        });
        client.on('message', async function(channel, tags, message, self) {
            const username = tags['display-name'] || 'Anonymous';
            const lowerMessage = message.trim().toLowerCase();
            const messageParts = message.trim().split(' ');
            const command = messageParts[0].toLowerCase();
            const args = messageParts.slice(1);
            const promptText = args.join(' ');

            // Prioritize mute/unmute commands
            if (muteSettings.getAllowSelfMute()) {
                const muteCmds = muteSettings.getMuteCommands();
                const unmuteCmds = muteSettings.getUnmuteCommands();
                if (muteCmds.includes(lowerMessage)) {
                    if (!ttsManager.isUserMuted(username)) {
                        ttsManager.toggleMuteUser(username);
                        chatUI.addSystemMessage(`${username} muted their TTS.`);
                    }
                    chatUI.addChatMessage(username, message, tags); 
                    return;
                }
                if (unmuteCmds.includes(lowerMessage)) {
                    if (ttsManager.isUserMuted(username)) {
                        ttsManager.toggleMuteUser(username);
                        chatUI.addSystemMessage(`${username} unmuted their TTS.`);
                    }
                    chatUI.addChatMessage(username, message, tags); 
                    return;
                }
            }

            // Check for !pickvoice command
            if (voiceSettings.isPickVoiceEnabled() && command === voiceSettings.getPickVoiceTrigger()) {
                chatUI.addChatMessage(username, message, tags); 
                const voiceQuery = args.join(' ').trim().toLowerCase();
                if(voiceQuery) {
                    const matchedVoice = voiceSettings.findMatchingVoice(voiceQuery);
                    if (matchedVoice) {
                        ttsManager.updateUserVoice(username, matchedVoice.name);
                        chatUI.addSystemMessage(`${username} switched voice to ${matchedVoice.name}`);
                    } else {
                        chatUI.addSystemMessage(`No matching voice found for query: "${voiceQuery}"`);
                    }
                } else {
                    chatUI.addSystemMessage(`Usage: ${voiceSettings.getPickVoiceTrigger()} <voice name or part of name>`);
                }
                return;
            }

            // Check for !image command
            if (command === imageGenManager.getCommandTrigger()) {
                chatUI.addChatMessage(username, message, tags); 
                await imageGenManager.handleImageCommand(username, promptText);
                return;
            }

            // Check for Custom Commands
            const customCmd = customCommands.getCustomCommand(lowerMessage);
            if (customCmd) {
                chatUI.addChatMessage(username, message, tags); 
                if (customCmd.type === "tts") {
                    ttsManager.queueCustomTTSMessage(customCmd.message, customCmd.voice, username);
                } else if (customCmd.type === "audio" && customCmd.preloadedAudio) {
                    ttsManager.playCustomAudio(customCmd.preloadedAudio.src); 
                } else if (customCmd.type === "audio" && customCmd.audioData) {
                    ttsManager.playCustomAudio(customCmd.audioData);
                }
                return;
            }

            // Check for Gamble Commands
            if (gambleManager.isGambleTrigger(lowerMessage)) {
                chatUI.addChatMessage(username, message, tags); 
                const handled = gambleManager.handleGambleCommand(username, message);
                if (handled) return; 
            }

            // If no command matched, display the message and queue TTS if applicable
            chatUI.addChatMessage(username, message, tags);

            const autoAddEnabled = config.getSetting('autoAddUserEnabled');
            const lowerUsername = username.toLowerCase();
            if (autoAddEnabled && !ttsManager.getTTSState().users.has(lowerUsername)) {
                ttsManager.addTTSUser(lowerUsername); 
            }

            if(ttsManager.getTTSState().users.has(lowerUsername) && !ttsManager.isUserMuted(lowerUsername)) {
                ttsManager.queueTTSMessage(message, username); 
            }
        });
    }

    function disconnectFromChat() {
        if (client) {
            client.disconnect();
            client = null;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        ttsManager.loadTTSState(); 
        gambleManager.loadGambleSettings(); 
        imageGenManager.loadImageGenSettings();
        muteSettings.loadMuteSettings(); 
        voiceSettings.loadVoiceSettings(); 
        customCommands.loadCustomCommands(); 
        scheduledEvents.load(); 

        customCommands.prepareCustomCommandAudioFiles(); 
        galleryDisplay.loadGallery(); 

        const setupVoices = () => {
            console.log("Setting up voices...");
            ttsManager.populateVoiceList(); 
            voiceSettings.applyVoiceBlacklist(); 
        };

        if (window.speechSynthesis.getVoices().length > 0) {
            console.log("Voices already available.");
            setupVoices();
        } else {
            console.log("Waiting for voices to load...");
            window.speechSynthesis.onvoiceschanged = setupVoices;
        }

        const lastChannel = localStorage.getItem('lastConnectedChannel');
        if (lastChannel) {
            channelInput.value = lastChannel;
        }
    });

})();