import * as chatUI from './chatUI.js';
import * as ttsManager from './ttsManager.js';
import * as gambleManager from './gambleManager.js';
import * as imageGenManager from './imageGenManager.js';
import * as config from 'config';

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

      const allowSelfMute = localStorage.getItem('allowSelfMute') === 'false' ? false : true;
      if (allowSelfMute) {
        const muteCommands = (localStorage.getItem('selfMuteCommands') || '!tts-off, !mute, bonesd3to').toLowerCase().split(',').map(s => s.trim());
        const unmuteCommands = (localStorage.getItem('selfUnmuteCommands') || '!tts, !tts-on, !unmute, bonesd3ts').toLowerCase().split(',').map(s => s.trim());
        if (muteCommands.includes(lowerMessage)) {
          if (!window.ttsManager.isUserMuted(username)) {
            window.ttsManager.toggleMuteUser(username);
          }
          return;
        }
        if (unmuteCommands.includes(lowerMessage)) {
          if (window.ttsManager.isUserMuted(username)) {
            window.ttsManager.toggleMuteUser(username);
          }
          return;
        }
      }

      if (lowerMessage.startsWith("!pickvoice ")) {
        if (localStorage.getItem("pickVoiceEnabled") === "true") {
          const voiceQuery = lowerMessage.substring("!pickvoice ".length).trim();
          let blacklistedVoices = [];
          try {
            blacklistedVoices = JSON.parse(localStorage.getItem("blacklistedVoices") || "[]");
          } catch (e) {}
          const voices = window.speechSynthesis.getVoices().filter(v => !blacklistedVoices.includes(v.name));
          const matchedVoice = voices.find(v => v.name.toLowerCase().includes(voiceQuery));
          if (matchedVoice) {
            window.ttsManager.updateUserVoice(username, matchedVoice.name);
            window.chatUI.addSystemMessage(`${username} switched voice to ${matchedVoice.name}`);
          } else {
            window.chatUI.addSystemMessage(`No matching voice found for query: ${voiceQuery}`);
          }
        }
        return;
      }

      if (command === imageGenManager.getCommandTrigger()) {
        await imageGenManager.handleImageCommand(username, promptText);
        chatUI.addChatMessage(username, message, tags);
        return;
      }

      if (window.getCustomCommand) {
        const customCmd = window.getCustomCommand(lowerMessage);
        if (customCmd) {
          chatUI.addChatMessage(username, message, tags);
          if (customCmd.type === "tts") {
            ttsManager.queueCustomTTSMessage(customCmd.message, customCmd.voice, username);
          } else if (customCmd.type === "audio") {
            ttsManager.playCustomAudio(customCmd.audioData);
          }
          return;
        }
      }

      if (gambleManager && gambleManager.isGambleTrigger(lowerMessage)) {
        const handled = gambleManager.handleGambleCommand(username, message);
        if (handled) return;
      }

      chatUI.addChatMessage(username, message, tags);
      ttsManager.queueTTSMessage(message, username);
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
    if (window.ttsManager) ttsManager.loadTTSState();
    if (window.gambleManager) { /* Potentially load gamble settings if needed here */ }
    if (window.imageGenManager) imageGenManager.loadImageGenSettings();
    if (window.galleryDisplay) galleryDisplay.loadGallery();
  });

  window.chatClient = {
    connectToChat: connectToChat,
    disconnectFromChat: disconnectFromChat
  };
})();