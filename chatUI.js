import * as ttsManager from './ttsManager.js'; 
import * as chatUtils from './chatUtils.js'; 

(function() {
    const chatBox = document.getElementById('chat-box');

    function addChatMessage(username, message, tags) {
         if (!chatBox) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        // Timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); 
        messageDiv.appendChild(timestamp);

        // Username Span
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'username';
        usernameSpan.textContent = username;
         // Add color based on tags if available (optional)
         if (tags && tags.color) {
             usernameSpan.style.color = tags.color;
         } else {
              usernameSpan.style.color = '#6441A4'; 
         }

        // Click-to-add TTS logic
        const ttsUsers = ttsManager.getTTSState().users;
        const lowerUsername = username.toLowerCase();
        if (!ttsUsers.has(lowerUsername)) {
            const autoAddEnabled = localStorage.getItem('autoAddUserEnabled') !== 'false'; 
            if (!autoAddEnabled) {
                usernameSpan.classList.add('clickable');
                usernameSpan.title = 'Click to add TTS for this user';
                usernameSpan.addEventListener('click', function handleAddClick() {
                    ttsManager.addTTSUser(lowerUsername);
                    usernameSpan.classList.remove('clickable');
                    usernameSpan.title = '';
                    usernameSpan.removeEventListener('click', handleAddClick);
                    window.chatUI.addSystemMessage(`Added ${username} to TTS.`);
                }, { once: true }); 
            }
        }
        messageDiv.appendChild(usernameSpan);

        // Colon separator
        const colonSpan = document.createElement('span');
        colonSpan.textContent = ': ';
        messageDiv.appendChild(colonSpan);

        // Message Content Span 
        const messageContent = document.createElement('span');
        messageContent.className = 'message-text'; 

        // --- Link and Censoring Logic ---
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        let lastIndex = 0;
        let match;

        while ((match = urlRegex.exec(message)) !== null) {
             const beforeText = message.substring(lastIndex, match.index);
             if (beforeText) {
                 const span = document.createElement('span');
                 span.innerHTML = chatUtils.censorBadWordsHtml(beforeText);
                 messageContent.appendChild(span);
             }

             const url = match[0];
             const linkElement = chatUtils.createLinkElement(url, ''); 
             messageContent.appendChild(linkElement);

             lastIndex = match.index + url.length;
        }

        const afterText = message.substring(lastIndex);
        if (afterText) {
             const span = document.createElement('span');
             span.innerHTML = chatUtils.censorBadWordsHtml(afterText);
             messageContent.appendChild(span);
        }
        // --- End Link/Censoring ---

        messageDiv.appendChild(messageContent);

        const shouldScroll = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 20; 

        chatBox.appendChild(messageDiv);

        if (shouldScroll) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        while (chatBox.children.length > 500) { 
            chatBox.removeChild(chatBox.firstChild);
        }
    }

    function addSystemMessage(message) {
         if (!chatBox) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message system-message'; 

        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        messageDiv.appendChild(timestamp);

        const systemSpan = document.createElement('span');
        systemSpan.className = 'system-text';
        systemSpan.textContent = message;
        messageDiv.appendChild(systemSpan);

        const shouldScroll = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 20;

        chatBox.appendChild(messageDiv);

        if (shouldScroll) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        while (chatBox.children.length > 500) {
             chatBox.removeChild(chatBox.firstChild);
        }
    }

    window.chatUI = {
        addChatMessage: addChatMessage,
        addSystemMessage: addSystemMessage
    };

})();