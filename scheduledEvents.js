import * as ttsManager from './ttsManager.js'; // Import ttsManager

// Use IIFE for now to maintain window.scheduledEvents structure easily
(function() {
    const localStorageKey = 'scheduledEvents';
    let scheduledEvents = [];
    let eventCheckInterval = null; // To store the interval ID

    const unitMultipliers = {
        Minutes: 60000,
        Hours: 3600000,
        Days: 86400000,
        // Removed Weeks, Months, Years for simplicity - complex date math needed otherwise
    };

    let unsavedScheduledChanges = false;
    let unsavedPromptedScheduled = false;

    function loadScheduledEvents() {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
            try {
                scheduledEvents = JSON.parse(stored);
                 // Ensure IDs are unique if loaded from old data without them
                 scheduledEvents.forEach(event => {
                     if (!event.id) event.id = Date.now() + Math.random();
                     // Remove potentially non-serializable preloadedAudio
                     delete event.preloadedAudio;
                 });
                 preloadEventAudio(); // Preload audio after loading
            } catch (e) {
                console.error('Error parsing scheduled events:', e);
                scheduledEvents = [];
            }
        } else {
             scheduledEvents = [];
        }
        startEventChecker(); // Start checking after loading
    }

    function saveScheduledEvents() {
         // Remove preloadedAudio before saving
         const eventsToSave = scheduledEvents.map(event => {
             const { preloadedAudio, ...rest } = event;
             return rest;
         });
        localStorage.setItem(localStorageKey, JSON.stringify(eventsToSave));
        unsavedScheduledChanges = false;
        unsavedPromptedScheduled = false;
        const warningDiv = document.getElementById('scheduled-unsaved-warning');
        if(warningDiv) warningDiv.style.display = 'none';
    }

     function preloadEventAudio() {
         scheduledEvents.forEach(event => {
             if (event.type === 'sound' && event.audioData && !event.preloadedAudio) {
                 try {
                      const audio = new Audio(event.audioData);
                      // audio.load(); // Not strictly necessary
                      event.preloadedAudio = audio;
                      console.log(`Preloaded audio for scheduled event: ${event.audioFileName || event.id}`);
                 } catch (e) {
                     console.error(`Error preloading audio for scheduled event ${event.id}:`, e);
                 }
             }
         });
     }

    function formatTimestampForInput(ts) {
        if (!ts || isNaN(ts)) ts = Date.now(); // Default to now if invalid
        const d = new Date(ts);
        // Adjust for local timezone offset before formatting
        const offset = d.getTimezoneOffset() * 60000;
        const localDate = new Date(d.getTime() - offset);
        return localDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    }

    function parseInputToTimestamp(val) {
        // Input 'datetime-local' gives string like "YYYY-MM-DDTHH:mm"
        // This is interpreted by Date() constructor in the *local* timezone
        return new Date(val).getTime();
    }

    function triggerEvent(event) {
        console.log(`Triggering scheduled event ID: ${event.id}, Type: ${event.type}`);
        if (event.type === 'tts' && event.message) {
            ttsManager.queueCustomTTSMessage(event.message, event.voice || '', 'Scheduled');
        } else if (event.type === 'sound' && event.preloadedAudio) {
             // Play the preloaded audio object directly
             event.preloadedAudio.play().catch(e => console.error("Scheduled audio playback error:", e));
        } else if (event.type === 'sound' && event.audioData) {
             // Fallback if preloading failed or wasn't done
             console.warn(`Playing scheduled audio ${event.id} from data URI (preloading might have failed).`);
             ttsManager.playCustomAudio(event.audioData); // Use ttsManager's function
        }
    }

     function populateScheduledEventsUI() {
         const listDiv = document.getElementById('scheduled-events-list');
         const modal = document.getElementById('scheduled-events-modal');
         if (!listDiv || !modal) return; // Ensure elements exist

         listDiv.innerHTML = ''; // Clear previous content
         const voices = window.speechSynthesis.getVoices(); // Get voices once

         if (scheduledEvents.length === 0) {
             listDiv.innerHTML = "<p style='font-size:1em; text-align:center; color:#666; margin:10px 0;'>No scheduled events defined.</p>";
             return;
         }

         scheduledEvents.forEach((event, index) => {
             const container = document.createElement('div');
             container.className = 'scheduled-event-item settings-form'; // Reuse settings-form class for layout

             // --- Type Selection ---
             const typeLabel = document.createElement('label');
             typeLabel.textContent = 'Event Type: ';
             const typeSelect = document.createElement('select');
             typeSelect.innerHTML = `
                 <option value="tts" ${event.type === 'tts' ? 'selected' : ''}>TTS Message</option>
                 <option value="sound" ${event.type === 'sound' ? 'selected' : ''}>Play Sound</option>
             `;
             typeSelect.addEventListener('change', (e) => {
                 event.type = e.target.value;
                 updateEventRowVisibility(container, event);
                 unsavedScheduledChanges = true;
             });
             typeLabel.appendChild(typeSelect);
             container.appendChild(typeLabel);

             // --- Scheduled Time ---
             const timeLabel = document.createElement('label');
             timeLabel.textContent = 'Scheduled Time: ';
             const timeInput = document.createElement('input');
             timeInput.type = 'datetime-local';
             timeInput.value = formatTimestampForInput(event.scheduledTime);
             timeInput.min = formatTimestampForInput(Date.now()); // Prevent setting past times (optional)
             timeInput.addEventListener('change', (e) => {
                  const newTime = parseInputToTimestamp(e.target.value);
                  // Basic validation: ensure it's not NaN and potentially not in the past
                  if (!isNaN(newTime)) { // && newTime >= Date.now() - 60000) { // Allow slightly in past for buffer
                     event.scheduledTime = newTime;
                     unsavedScheduledChanges = true;
                  } else {
                      alert("Invalid date/time selected.");
                      e.target.value = formatTimestampForInput(event.scheduledTime); // Revert UI
                  }
             });
             timeLabel.appendChild(timeInput);
             container.appendChild(timeLabel);

             // --- Repeat Interval ---
             const repeatLabel = document.createElement('label');
             repeatLabel.textContent = 'Repeat Interval (0 for one-time): ';
             const repeatDiv = document.createElement('div'); // Group number and unit
             repeatDiv.style.display = 'flex';
             repeatDiv.style.gap = '5px';

             const repeatNumber = document.createElement('input');
             repeatNumber.type = 'number';
             repeatNumber.min = '0';
             repeatNumber.style.width = '80px';
             repeatNumber.value = event.repeatValue || '0'; // Use repeatValue stored
             repeatNumber.placeholder = "Value";

             const unitSelect = document.createElement('select');
             unitSelect.innerHTML = Object.keys(unitMultipliers).map(unit => `<option value="${unit}" ${(event.repeatUnit === unit) ? 'selected' : ''}>${unit}</option>`).join('');

             const updateRepeatInterval = () => {
                 const val = parseInt(repeatNumber.value);
                 const unit = unitSelect.value;
                 if (!isNaN(val) && val > 0 && unitMultipliers[unit]) {
                     event.repeatInterval = val * unitMultipliers[unit];
                     event.repeatValue = val;
                     event.repeatUnit = unit;
                 } else {
                     event.repeatInterval = 0;
                     event.repeatValue = 0; // Store 0 explicitly
                     delete event.repeatUnit;
                     repeatNumber.value = '0'; // Ensure UI reflects 0 interval
                 }
                 unsavedScheduledChanges = true;
             };

             repeatNumber.addEventListener('input', updateRepeatInterval);
             unitSelect.addEventListener('change', updateRepeatInterval);

             repeatDiv.appendChild(repeatNumber);
             repeatDiv.appendChild(unitSelect);
             repeatLabel.appendChild(repeatDiv);
             container.appendChild(repeatLabel);


             // --- TTS Details ---
             const ttsDetails = document.createElement('div');
             ttsDetails.className = 'event-tts-details';
             ttsDetails.style.display = event.type === 'tts' ? 'block' : 'none';

             const messageLabel = document.createElement('label');
             messageLabel.textContent = 'TTS Message: ';
             const messageInput = document.createElement('textarea'); // Use textarea for longer messages
             messageInput.rows = 2;
             messageInput.placeholder = 'Enter TTS message';
             messageInput.value = event.message || '';
             messageInput.addEventListener('input', (e) => {
                 event.message = e.target.value;
                 unsavedScheduledChanges = true;
             });
             messageLabel.appendChild(messageInput);
             ttsDetails.appendChild(messageLabel);

             const voiceLabel = document.createElement('label');
             voiceLabel.textContent = 'Voice: ';
             const voiceSelect = document.createElement('select');
             voiceSelect.dataset.purpose = "voice-select"; // Add marker for ttsManager updates
             if (!voices.length) {
                 voiceSelect.innerHTML = `<option>Loading voices...</option>`;
             } else {
                 voiceSelect.innerHTML = voices.map(voice => `<option value="${voice.name}" ${(event.voice === voice.name) ? 'selected' : ''}>${voice.name} (${voice.lang})</option>`).join('');
             }
             voiceSelect.addEventListener('change', (e) => {
                 event.voice = e.target.value;
                 unsavedScheduledChanges = true;
             });
             voiceLabel.appendChild(voiceSelect);
             ttsDetails.appendChild(voiceLabel);
             container.appendChild(ttsDetails);

             // --- Sound Details ---
             const soundDetails = document.createElement('div');
             soundDetails.className = 'event-sound-details';
             soundDetails.style.display = event.type === 'sound' ? 'block' : 'none';

             const fileLabel = document.createElement('label');
             fileLabel.textContent = 'Audio File: ';
             const fileInputDiv = document.createElement('div');
             fileInputDiv.style.display = 'flex';
             fileInputDiv.style.alignItems = 'center';
             fileInputDiv.style.gap = '10px';

             const audioLabelSpan = document.createElement('span');
             audioLabelSpan.className = 'audio-file-label';
             audioLabelSpan.textContent = event.audioFileName ? event.audioFileName : (event.audioData ? 'File loaded' : 'No file chosen');
             audioLabelSpan.style.flexGrow = '1'; // Allow label to take space
             audioLabelSpan.style.overflow = 'hidden';
             audioLabelSpan.style.textOverflow = 'ellipsis';
             audioLabelSpan.style.whiteSpace = 'nowrap';


             const fileInput = document.createElement('input');
             fileInput.type = 'file';
             fileInput.accept = 'audio/*';
             fileInput.style.display = 'none'; // Hide default input
             const fileInputId = `scheduled-audio-input-${event.id}`;
             fileInput.id = fileInputId;

             const chooseFileButton = document.createElement('button');
             chooseFileButton.type = 'button';
             chooseFileButton.textContent = 'Choose File';
             chooseFileButton.onclick = () => fileInput.click();


             fileInput.addEventListener('change', (e) => {
                 const file = e.target.files[0];
                 if (file) {
                      // Basic size check (e.g., 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                          alert("Audio file is too large (Max 5MB). Please choose a smaller file.");
                          e.target.value = null; // Clear selection
                          return;
                      }
                     const reader = new FileReader();
                     reader.onload = function(ev) {
                         event.audioData = ev.target.result; // Store base64 data URL
                         event.audioFileName = file.name;
                         audioLabelSpan.textContent = file.name;
                         // Preload immediately
                         preloadEventAudio(); // This will find the updated event
                         unsavedScheduledChanges = true;
                         e.target.value = null; // Clear selection visually
                     };
                      reader.onerror = () => {
                          alert("Error reading audio file.");
                           e.target.value = null; // Clear selection visually
                      };
                     reader.readAsDataURL(file);
                 }
             });

             fileInputDiv.appendChild(audioLabelSpan);
             fileInputDiv.appendChild(fileInput);
             fileInputDiv.appendChild(chooseFileButton);
             fileLabel.appendChild(fileInputDiv);
             soundDetails.appendChild(fileLabel);
             container.appendChild(soundDetails);


             // --- Delete Button ---
             const deleteBtn = document.createElement('button');
             deleteBtn.type = 'button'; // Prevent form submission if nested
             deleteBtn.textContent = 'Delete Event';
             deleteBtn.className = 'control-btn clear-btn'; // Style as delete button
             deleteBtn.style.marginTop = '10px';
             deleteBtn.addEventListener('click', () => {
                 if (confirm(`Are you sure you want to delete this scheduled event?`)) {
                     scheduledEvents.splice(index, 1);
                     saveScheduledEvents(); // Save immediately after deletion
                     populateScheduledEventsUI(); // Redraw UI
                 }
             });
             container.appendChild(deleteBtn);

             listDiv.appendChild(container);
         });
     }

      // Update visibility of TTS/Sound details within an event row
     function updateEventRowVisibility(row, event) {
         const ttsDetails = row.querySelector('.event-tts-details');
         const soundDetails = row.querySelector('.event-sound-details');
         if (!ttsDetails || !soundDetails) return;

         ttsDetails.style.display = event.type === 'tts' ? 'block' : 'none';
         soundDetails.style.display = event.type === 'sound' ? 'block' : 'none';
     }

     function addNewScheduledEvent() {
         const voices = window.speechSynthesis.getVoices();
         const newEvent = {
             id: Date.now() + Math.random(), // Unique ID
             type: 'tts',
             scheduledTime: Date.now() + 5 * 60000, // Default to 5 mins from now
             repeatInterval: 0, // One-time default
             repeatValue: 0,
             message: 'This is a scheduled message!',
             voice: (voices[0] || {}).name || '', // Default voice
             audioData: null,
             audioFileName: null
         };
         scheduledEvents.push(newEvent);
         // Don't save yet, let user configure and press Save button
         unsavedScheduledChanges = true;
         populateScheduledEventsUI(); // Redraw UI to include the new blank event
     }

    function checkAndExecuteScheduledEvents() {
        const now = Date.now();
        let modified = false; // Track if events were executed or rescheduled

        for (let i = scheduledEvents.length - 1; i >= 0; i--) {
            const event = scheduledEvents[i];
            if (!event || isNaN(event.scheduledTime)) continue; // Skip invalid events

            // Check if the scheduled time is past (within a small buffer like 1 sec)
            if (event.scheduledTime <= now + 1000) {
                triggerEvent(event);

                // Handle repetition
                if (event.repeatInterval && event.repeatInterval > 0) {
                     // Calculate next time based on the *original* scheduled time plus intervals
                     // This prevents drift if execution is delayed
                     let nextTime = event.scheduledTime;
                     while (nextTime <= now) { // Find the next occurrence after 'now'
                         nextTime += event.repeatInterval;
                     }
                     console.log(`Rescheduling event ${event.id} from ${new Date(event.scheduledTime).toLocaleString()} to ${new Date(nextTime).toLocaleString()}`);
                     event.scheduledTime = nextTime;
                     modified = true;
                } else {
                    // One-time event, remove it
                    console.log(`Removing one-time event ${event.id}`);
                    scheduledEvents.splice(i, 1);
                    modified = true;
                }
            }
        }

        // If events were modified (executed, rescheduled, removed), save the changes
        if (modified) {
            saveScheduledEvents();
             // Update UI only if the modal is currently open
             const modal = document.getElementById('scheduled-events-modal');
             if (modal && modal.style.display === 'block') {
                 populateScheduledEventsUI();
             }
        }
    }

     function startEventChecker() {
         if (eventCheckInterval) {
             clearInterval(eventCheckInterval); // Clear existing interval if any
         }
         // Check frequently (e.g., every 5 seconds) for upcoming events
         eventCheckInterval = setInterval(checkAndExecuteScheduledEvents, 5000);
         console.log("Scheduled event checker started.");
     }

     function stopEventChecker() {
          if (eventCheckInterval) {
             clearInterval(eventCheckInterval);
             eventCheckInterval = null;
             console.log("Scheduled event checker stopped.");
         }
     }

     // --- Modal and Button Event Listeners ---
     function setupModalListeners() {
        const openBtn = document.getElementById('scheduled-events-btn');
        const modal = document.getElementById('scheduled-events-modal');
        const addBtn = document.getElementById('add-scheduled-event-btn');
        const saveBtn = document.getElementById('save-scheduled-events');
        const closeBtn = document.getElementById('close-scheduled-events');
        const warningDiv = document.getElementById('scheduled-unsaved-warning');

        if (!openBtn || !modal || !addBtn || !saveBtn || !closeBtn || !warningDiv) {
             console.warn("Scheduled Events UI elements not found.");
             return;
        }

        openBtn.addEventListener('click', () => {
            loadScheduledEvents(); // Load latest from storage
            populateScheduledEventsUI(); // Populate UI
            unsavedScheduledChanges = false; // Reset unsaved flag
            unsavedPromptedScheduled = false;
            warningDiv.style.display = 'none';
            modal.style.display = 'block';
            startEventChecker(); // Ensure checker is running when modal is open
        });

        addBtn.addEventListener('click', addNewScheduledEvent);

        saveBtn.addEventListener('click', () => {
            saveScheduledEvents(); // Saves current state from UI edits
            preloadEventAudio(); // Ensure any new audio is preloaded
            alert("Scheduled events saved.");
            // Keep modal open after saving? Or close? Let's keep it open.
            // modal.style.display = 'none';
        });

        const closeAction = (force = false) => {
            if (!force && unsavedScheduledChanges) {
                if (!unsavedPromptedScheduled) {
                    warningDiv.textContent = "You have unsaved changes. Click Close again to discard changes.";
                    warningDiv.style.display = 'block';
                    unsavedPromptedScheduled = true;
                } else {
                    modal.style.display = 'none'; // Discard changes
                }
            } else {
                modal.style.display = 'none'; // Close normally
            }
        };

        closeBtn.addEventListener('click', () => closeAction());

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAction(); // Use same close logic for background click
            }
        });
     }


    // --- Exports ---
    window.scheduledEvents = {
        load: loadScheduledEvents,
        save: saveScheduledEvents,
        populateUI: populateScheduledEventsUI,
        getEvents: () => [...scheduledEvents] // Return a copy
    };

    // --- Initial Load ---
    document.addEventListener('DOMContentLoaded', () => {
         loadScheduledEvents(); // Load events on page load
         setupModalListeners(); // Setup modal listeners
         // Event checker is started by loadScheduledEvents
    });

})();