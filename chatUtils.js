import * as ttsManager from './ttsManager.js'; 

(function() {
    window.chatUtils = {};

    let badWordsData = [];
    window.chatUtils.badWordsData = badWordsData;

    fetch('en.json')
        .then(function(response) {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(function(data) {
            if (Array.isArray(data)) {
                 badWordsData = data;
                 window.chatUtils.badWordsData = badWordsData;
                 console.log("Bad words filter list loaded.");
            } else {
                 console.error('Loaded bad words data is not an array:', data);
                 badWordsData = []; 
                 window.chatUtils.badWordsData = badWordsData;
            }
        })
        .catch(function(error) {
            console.error('Error loading or parsing bad words data (en.json):', error);
             badWordsData = []; 
             window.chatUtils.badWordsData = badWordsData;
        });

    window.chatUtils.censorBadWordsForTTS = function(text) {
        let censoredText = text;
        if (ttsManager.getTTSState().filterEnabled && badWordsData.length > 0) {
            badWordsData.forEach(function(category) {
                if (category && Array.isArray(category.dictionary)) {
                    category.dictionary.forEach(function(entry) {
                        if (entry && typeof entry.match === 'string') {
                            const matches = entry.match.split('|');
                            matches.forEach(function(match) {
                                if (match) { 
                                    try {
                                         const regex = new RegExp(`\\b${match.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'); 
                                         censoredText = censoredText.replace(regex, ' '); 
                                    } catch (e) {
                                         console.warn(`Could not create regex for bad word: ${match}`, e);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
        return censoredText;
    };

    window.chatUtils.censorBadWordsHtml = function(text) {
        if (!ttsManager.getTTSState().filterEnabled || badWordsData.length === 0) {
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        let resultHtml = text;
        badWordsData.forEach(function(category) {
             if (category && Array.isArray(category.dictionary)) {
                category.dictionary.forEach(function(entry) {
                     if (entry && typeof entry.match === 'string') {
                        const words = entry.match.split('|');
                        words.forEach(function(word) {
                            if (word) {
                                try {
                                    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                    const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
                                    resultHtml = resultHtml.replace(regex, function(match) {
                                        const escapedMatch = match.replace(/"/g, '&quot;');
                                        return `<span class="censored-word" title="${escapedMatch}">${'*'.repeat(match.length)}</span>`;
                                    });
                                } catch (e) {
                                     console.warn(`Could not create regex for bad word: ${word}`, e);
                                }
                            }
                        });
                     }
                });
            }
        });
        return resultHtml;
    };

    window.chatUtils.splitMessageIntoChunks = function(text, maxLength = 180) {
        if (/^https?:\/\/[^\s]+$/.test(text.trim())) {
             return []; 
         }
         let textWithoutUrls = text.replace(/https?:\/\/[^\s]+/g, ' ').trim();

         if (!textWithoutUrls) {
             return []; 
         }

        const ttsCensoredText = window.chatUtils.censorBadWordsForTTS(textWithoutUrls);

        const sentenceEnders = /[.!?]+(?=\s+|$)/g;
        const potentialSentences = ttsCensoredText.split(sentenceEnders);
        const chunks = [];
        let currentChunk = '';

        potentialSentences.forEach(segment => {
            segment = segment.trim();
            if (!segment) return;

            if (segment.length > maxLength) {
                const words = segment.split(/\s+/);
                let segmentChunk = '';
                words.forEach(word => {
                    if ((segmentChunk + ' ' + word).length <= maxLength) {
                        segmentChunk += (segmentChunk ? ' ' : '') + word;
                    } else {
                         if (segmentChunk) chunks.push([segmentChunk.trim(), segmentChunk.trim()]); 
                        segmentChunk = word; 
                    }
                });
                 if (segmentChunk) chunks.push([segmentChunk.trim(), segmentChunk.trim()]); 
            }
            else if ((currentChunk + ' ' + segment).length <= maxLength) {
                currentChunk += (currentChunk ? ' ' : '') + segment;
            }
            else {
                 if (currentChunk) chunks.push([currentChunk.trim(), currentChunk.trim()]);
                currentChunk = segment; 
            }
        });

        if (currentChunk) chunks.push([currentChunk.trim(), currentChunk.trim()]);

        return chunks.filter(chunk => chunk[0].length > 0);
    };

    window.chatUtils.createLinkElement = function(url, metadata) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer'; 
        link.textContent = url; 
        link.style.color = '#6441A4'; 
        link.style.textDecoration = 'underline'; 
        link.style.wordBreak = 'break-all'; 

        const container = document.createElement('span'); 
        container.appendChild(link);

        if (metadata) {
            const metadataSpan = document.createElement('span');
            metadataSpan.textContent = ` (${metadata})`;
            metadataSpan.style.color = '#666';
            metadataSpan.style.fontSize = '0.9em';
            container.appendChild(metadataSpan);
        }
        return container;
    };

    window.chatUtils.isMusicServiceUrl = function(url) {
        return /\b(youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)\b/i.test(url);
    };

    window.chatUtils.getMediaInfo = async function(url) {
        return null; 
    };
})();