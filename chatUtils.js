(function() {
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

  // This function returns a simple censored text (all bad words replaced with asterisks)
  window.chatUtils.censorBadWords = function(text) {
    let censoredText = text;
    if (window.ttsManager && window.ttsManager.getTTSState().filterEnabled) {
      badWordsData.forEach(function(category) {
        category.dictionary.forEach(function(entry) {
          const matches = entry.match.split('|');
          matches.forEach(function(match) {
            const regex = new RegExp(`\\b${match}\\b`, 'gi');
            censoredText = censoredText.replace(regex, '*'.repeat(match.length));
          });
        });
      });
    }
    return censoredText;
  };

  // New function to return HTML with censored words wrapped in a tooltip.
  window.chatUtils.censorBadWordsHtml = function(text) {
    if (!(window.ttsManager && window.ttsManager.getTTSState().filterEnabled)) {
      // If filtering is not enabled, return text as is (escaped)
      // Here we assume text is safe or already escaped.
      return text;
    }
    let result = text;
    badWordsData.forEach(function(category) {
      category.dictionary.forEach(function(entry) {
        const words = entry.match.split('|');
        words.forEach(function(word) {
          // Use capturing group so we can get the actual match word even with different case.
          const regex = new RegExp(`\\b(${word})\\b`, 'gi');
          result = result.replace(regex, function(match) {
            return `<span class="censored-word" title="${match}">${'*'.repeat(match.length)}</span>`;
          });
        });
      });
    });
    return result;
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