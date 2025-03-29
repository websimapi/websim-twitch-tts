import * as chatUI from './chatUI.js';
import * as ttsManager from './ttsManager.js';
import * as gambleManager from './gambleManager.js';
import * as imageGenManager from './imageGenManager.js';
import * as config from 'config';
import * as customCommands from './customCommands.js';
import * as muteSettings from './muteSettings.js';
import * as voiceSettings from './voiceSettings.js';

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

            if (muteSettings.getAllowSelfMute()) {
                const muteCmds = muteSettings.getMuteCommands();
                const unmuteCmds = muteSettings.getUnmuteCommands();
                if (muteCmds.includes(lowerMessage)) {
                    if (!ttsManager.isUserMuted(username)) {
                        ttsManager.toggleMuteUser(username);
                        chatUI.addSystemMessage(`${username} muted their TTS.`);
                    }
                    return; 
                }
                if (unmuteCmds.includes(lowerMessage)) {
                    if (ttsManager.isUserMuted(username)) {
                        ttsManager.toggleMuteUser(username);
                        chatUI.addSystemMessage(`${username} unmuted their TTS.`);
                    }
                    return; 
                }
            }

            if (voiceSettings.isPickVoiceEnabled() && command === voiceSettings.getPickVoiceTrigger()) {
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
                chatUI.addChatMessage(username, message, tags); 
                return; 
            }

            if (command === imageGenManager.getCommandTrigger()) {
                await imageGenManager.handleImageCommand(username, promptText);
                chatUI.addChatMessage(username, message, tags); 
                return; 
            }

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

            if (gambleManager && gambleManager.isGambleTrigger(lowerMessage)) {
                const handled = gambleManager.handleGambleCommand(username, message);
                chatUI.addChatMessage(username, message, tags); 
                if (handled) return; 
            }

            chatUI.addChatMessage(username, message, tags);

            const autoAddEnabled = config.getSetting('autoAddUserEnabled');
            if (autoAddEnabled && !ttsManager.getTTSState().users.has(username.toLowerCase())) {
                ttsManager.addTTSUser(username.toLowerCase()); 
            }

            if(ttsManager.getTTSState().users.has(username.toLowerCase()) && !ttsManager.isUserMuted(username)) {
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
        const lastChannel = localStorage.getItem('lastConnectedChannel');
        if (lastChannel) {
            channelInput.value = lastChannel;
        }
        ttsManager.loadTTSState(); 
        gambleManager.loadGambleSettings(); 
        imageGenManager.loadImageGenSettings();
        muteSettings.loadMuteSettings(); 
        voiceSettings.loadVoiceSettings(); 
        customCommands.loadCustomCommands(); 
        customCommands.prepareCustomCommandAudioFiles(); 
        if (window.galleryDisplay) galleryDisplay.loadGallery();
        if (window.scheduledEvents) window.scheduledEvents.load(); 

        window.speechSynthesis.onvoiceschanged = () => {
           ttsManager.populateVoiceList(); 
           voiceSettings.loadVoiceSettings(); 
        };
        if (window.speechSynthesis.getVoices().length > 0) {
           ttsManager.populateVoiceList();
           voiceSettings.loadVoiceSettings();
        }
    });

})();