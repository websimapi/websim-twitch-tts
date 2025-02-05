(function() {
  // Helper function to escape regex special characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Helper: Create a DocumentFragment from an HTML string.
  function buildFragmentFromHTML(htmlString) {
    const temp = document.createElement('div');
    temp.innerHTML = htmlString;
    const frag = document.createDocumentFragment();
    while (temp.firstChild) {
      frag.appendChild(temp.firstChild);
    }
    return frag;
  }
  
  window.chatUtils = {};

  let badWordsData = [];
  window.chatUtils.badWordsData = badWordsData;

  fetch('en.json')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      badWordsData = data;
      window.chatUtils.badWordsData = badWordsData;
    })
    .catch(function(error) {
      console.error('Error loading bad words data:', error);
    });

  // Updated censorBadWords: Replace filtered words with asterisks wrapped in a span.
  // When hovered, the span shows the original word in a tooltip.
  window.chatUtils.censorBadWords = function(text) {
    let result = text;
    if (window.ttsManager && window.ttsManager.getTTSState().filterEnabled) {
      badWordsData.forEach(function(category) {
        category.dictionary.forEach(function(entry) {
          const words = entry.match.split('|');
          words.forEach(function(word) {
            const regex = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'gi');
            result = result.replace(regex, function(match) {
              return `<span class="censored" title="${match}">${"*".repeat(match.length)}</span>`;
            });
          });
        });
      });
    }
    return result;
  };

  // New helper to build a DocumentFragment for censored text.
  window.chatUtils.buildCensoredElement = function(text) {
    return buildFragmentFromHTML(window.chatUtils.censorBadWords(text));
  };

  window.chatUtils.splitMessageIntoChunks = function(text, maxLength = 180) {
    if (/https?:\/\/[^\s]+/.test(text)) {
      const parts = text.split(/https?:\/\/[^\s]+/);
      const nonUrlText = parts.join(' ').trim();
      return nonUrlText ? window.chatUtils.splitMessageIntoChunks(nonUrlText) : [];
    }
    let ttsText = text;
    if (window.ttsManager && window.ttsManager.getTTSState().filterEnabled) {
      badWordsData.forEach(function(category) {
        category.dictionary.forEach(function(entry) {
          const matches = entry.match.split('|');
          matches.forEach(function(match) {
            const regex = new RegExp(`\\b${match}\\b`, 'gi');
            ttsText = ttsText.replace(regex, ' ');
          });
        });
      });
    }
    const punctuationSplit = ttsText.split(/([.!?]+\s+)/g);
    const chunks = [];
    let currentChunk = '';
    punctuationSplit.forEach(function(segment) {
      if ((currentChunk + segment).length <= maxLength) {
        currentChunk += segment;
      } else {
        if (currentChunk) chunks.push([currentChunk.trim(), window.chatUtils.censorBadWords(currentChunk.trim())]);
        if (segment.length > maxLength) {
          const words = segment.split(/\s+/);
          currentChunk = '';
          words.forEach(function(word) {
            if ((currentChunk + ' ' + word).length <= maxLength) {
              currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
              if (currentChunk) chunks.push([currentChunk.trim(), window.chatUtils.censorBadWords(currentChunk.trim())]);
              currentChunk = word;
            }
          });
        } else {
          currentChunk = segment;
        }
      }
    });
    if (currentChunk) chunks.push([currentChunk.trim(), window.chatUtils.censorBadWords(currentChunk.trim())]);
    return chunks.filter(function(chunk) {
      return chunk[0].length > 0;
    });
  };

  window.chatUtils.createLinkElement = function(url, metadata) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.textContent = url;
    link.style.color = '#6441A4';
    link.style.textDecoration = 'none';
    
    const container = document.createElement('span');
    container.appendChild(link);
    
    if (metadata) {
      const metadataSpan = document.createElement('span');
      metadataSpan.textContent = ` (${metadata})`;
      metadataSpan.style.color = '#666';
      container.appendChild(metadataSpan);
    }
    return container;
  };

  window.chatUtils.isMusicServiceUrl = function(url) {
    return url.match(/youtube\.com|youtu\.be|spotify\.com|soundcloud\.com/i);
  };

  window.chatUtils.getMediaInfo = async function(url) {
    return null;
  };
})();