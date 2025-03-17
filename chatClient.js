(function() {
  // Create logger for this module
  const logger = window.debugLogger ? window.debugLogger.createLogger('ChatClient') : console;
  
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
      logger.error('No channel name provided');
      alert('Please enter a channel name');
      return;
    }
    
    logger.info(`Connecting to channel: ${channel}`);
    localStorage.setItem('lastConnectedChannel', channel);
    client = new window.tmi.Client({
      connection: {
        secure: true,
        reconnect: true
      },
      channels: [channel]
    });
    
    client.connect().catch(error => {
      logger.error('Connection error', error.toString());
      console.error(error);
    });
    
    client.on('connected', function() {
      logger.info(`Connected to ${channel}'s chat`);
      statusDiv.className = 'status connected';
      statusDiv.textContent = `Connected to ${channel}'s chat`;
      connectButton.textContent = 'Disconnect';
    });
    
    client.on('disconnected', function() {
      logger.info('Disconnected from chat');
      statusDiv.className = 'status disconnected';
      statusDiv.textContent = 'Disconnected from chat';
      connectButton.textContent = 'Connect';
    });
    
    client.on('message', function(channel, tags, message, self) {
      const username = tags['display-name'] || 'Anonymous';
      logger.debug(`Message from ${username}`, message);
      
      // Check for self mute/unmute commands if allowed
      const allowSelfMute = localStorage.getItem('allowSelfMute') === 'false' ? false : true;
      if (allowSelfMute && window.ttsManager && window.ttsManager.isUserMuted) {
        const muteCommands = (localStorage.getItem('selfMuteCommands') || '!tts-off, !mute, bonesd3to').toLowerCase().split(',').map(s => s.trim());
        const unmuteCommands = (localStorage.getItem('selfUnmuteCommands') || '!tts, !tts-on, !unmute, bonesd3ts').toLowerCase().split(',').map(s => s.trim());
        const lowerMessage = message.trim().toLowerCase();
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
      
      // Process voice pick command if enabled
      const lowerMessage = message.trim().toLowerCase();
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
      
      if (window.getCustomCommand) {
        const customCmd = window.getCustomCommand(lowerMessage);
        if (customCmd) {
          window.chatUI.addChatMessage(username, message, tags);
          if (customCmd.type === "tts") {
            window.ttsManager.queueCustomTTSMessage(customCmd.message, customCmd.voice, username);
          } else if (customCmd.type === "audio") {
            window.ttsManager.playCustomAudio(customCmd.audioData);
          }
          return;
        }
      }
      if (window.gambleManager && window.gambleManager.isGambleTrigger) {
        const handled = window.gambleManager.handleGambleCommand(username, message);
        if (handled) return;
      }
      if (window.chatUI) {
        window.chatUI.addChatMessage(username, message, tags);
      }
      if (window.ttsManager && window.ttsManager.queueTTSMessage) {
        window.ttsManager.queueTTSMessage(message, username);
      }
    });
  }

  function disconnectFromChat() {
    if (client) {
      logger.info('Disconnecting from chat');
      client.disconnect();
      client = null;
    }
  }

  window.addEventListener('DOMContentLoaded', function() {
    const lastChannel = localStorage.getItem('lastConnectedChannel');
    if (lastChannel) {
      channelInput.value = lastChannel;
    }
  });

  window.chatClient = {
    connectToChat: connectToChat,
    disconnectFromChat: disconnectFromChat
  };
})();