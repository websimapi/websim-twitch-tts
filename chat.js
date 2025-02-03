// Store the TMI client globally
let client = null;

// Initialize elements
const channelInput = document.getElementById('channel-input');
const connectButton = document.getElementById('connect-btn');
const chatBox = document.getElementById('chat-box');
const statusDiv = document.getElementById('status');

// Handle connect/disconnect
connectButton.addEventListener('click', () => {
  if (client && client.readyState() === 'OPEN') {
    disconnectFromChat();
  } else {
    connectToChat();
  }
});

function connectToChat() {
  const channel = channelInput.value.toLowerCase().trim();
  
  if (!channel) {
    alert('Please enter a channel name');
    return;
  }

  // Create new client using the imported tmi library
  client = new window.tmi.Client({
    connection: {
      secure: true,
      reconnect: true
    },
    channels: [channel]
  });

  // Handle connection
  client.connect().catch(console.error);

  // Setup event handlers
  client.on('connected', () => {
    statusDiv.className = 'status connected';
    statusDiv.textContent = `Connected to ${channel}'s chat`;
    connectButton.textContent = 'Disconnect';
  });

  client.on('disconnected', () => {
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = 'Disconnected from chat';
    connectButton.textContent = 'Connect';
  });

  client.on('message', (channel, tags, message, self) => {
    addChatMessage(tags['display-name'], message, tags);
  });
}

function disconnectFromChat() {
  if (client) {
    client.disconnect();
    client = null;
  }
}

function addChatMessage(username, message, tags) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString();
  const timestampSpan = document.createElement('span');
  timestampSpan.className = 'timestamp';
  timestampSpan.textContent = timestamp;
  messageDiv.appendChild(timestampSpan);

  // Add username
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = username;
  messageDiv.appendChild(usernameSpan);

  // Add message
  const messageText = document.createElement('span');
  messageText.textContent = `: ${message}`;
  messageDiv.appendChild(messageText);

  // Add to chat box and scroll to bottom
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Limit messages to prevent memory issues
  while (chatBox.children.length > 500) {
    chatBox.removeChild(chatBox.firstChild);
  }
}

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});