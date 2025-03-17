(function() {
  const chatBox = document.getElementById('chat-box');

  function addChatMessage(username, message, tags) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestamp);
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = username;
    
    const ttsUsers = window.ttsManager && window.ttsManager.getTTSState ? 
      window.ttsManager.getTTSState().users : new Map();
      
    if (!ttsUsers.has(username.toLowerCase())) {
      const autoAddEnabled = localStorage.getItem('autoAddUserEnabled') === 'false' ? false : true;
      if (autoAddEnabled && window.ttsManager && window.ttsManager.addTTSUser) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) {
          const randomVoice = voices[Math.floor(Math.random() * voices.length)].name;
          window.ttsManager.addTTSUser(username.toLowerCase(), randomVoice);
        }
      } else {
        usernameSpan.classList.add('clickable');
        usernameSpan.title = 'Click to add TTS for this user';
        usernameSpan.addEventListener('click', function() {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length) {
            const randomVoice = voices[Math.floor(Math.random() * voices.length)].name;
            window.ttsManager.addTTSUser(username.toLowerCase(), randomVoice);
          }
        });
      }
    }
    messageDiv.appendChild(usernameSpan);
    const colonSpan = document.createElement('span');
    colonSpan.textContent = ': ';
    messageDiv.appendChild(colonSpan);
    const messageContent = document.createElement('span');
    
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urlMatches = [...message.matchAll(urlRegex)];
    
    if (urlMatches.length > 0) {
      let lastIndex = 0;
      for (const match of urlMatches) {
        const url = match[0];
        const beforeText = message.substring(lastIndex, match.index);
        if (beforeText) {
          const span = document.createElement('span');
          span.innerHTML = window.chatUtils.censorBadWordsHtml(beforeText);
          messageContent.appendChild(span);
        }
        if (window.chatUtils.isMusicServiceUrl(url)) {
          const linkElement = window.chatUtils.createLinkElement(url, '');
          messageContent.appendChild(linkElement);
          window.chatUtils.getMediaInfo(url).then(function(metadata) {
            if (metadata) {
              linkElement.lastChild.textContent = ` (${metadata})`;
            }
          });
        } else {
          const linkText = document.createTextNode(url);
          messageContent.appendChild(linkText);
        }
        lastIndex = match.index + url.length;
      }
      const afterText = message.substring(lastIndex);
      if (afterText) {
        const span = document.createElement('span');
        span.innerHTML = window.chatUtils.censorBadWordsHtml(afterText);
        messageContent.appendChild(span);
      }
    } else {
      messageContent.innerHTML = window.chatUtils.censorBadWordsHtml(message);
    }
    messageDiv.appendChild(messageContent);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    while (chatBox.children.length > 500) {
      chatBox.removeChild(chatBox.firstChild);
    }
  }
  
  function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message system-message';
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestamp);
    const systemSpan = document.createElement('span');
    systemSpan.className = 'system-text';
    systemSpan.textContent = message;
    messageDiv.appendChild(systemSpan);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  window.chatUI = {
    addChatMessage: addChatMessage,
    addSystemMessage: addSystemMessage
  };
})();