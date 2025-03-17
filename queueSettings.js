(function() {
  function setupQueueSettingsModal() {
    const openBtn = document.getElementById('queue-settings-btn');
    const modal = document.getElementById('queue-settings-modal');
    const closeBtn = document.getElementById('close-queue-settings');
    const saveBtn = document.getElementById('save-queue-settings');
    const autoSkipToggle = document.getElementById('queue-auto-skip-toggle');
    const thresholdInput = document.getElementById('queue-threshold-seconds');
    const maxQueueInput = document.getElementById('queue-max-length');
    
    // On open, load stored settings with defaults
    openBtn.addEventListener('click', () => {
      autoSkipToggle.checked = localStorage.getItem('queueAutoSkipEnabled') === 'true';
      thresholdInput.value = localStorage.getItem('queueThresholdSeconds') || 7;
      maxQueueInput.value = localStorage.getItem('queueMaxLength') || 100;
      modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Clicking outside modal content closes modal
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    saveBtn.addEventListener('click', () => {
      localStorage.setItem('queueAutoSkipEnabled', autoSkipToggle.checked ? 'true' : 'false');
      localStorage.setItem('queueThresholdSeconds', thresholdInput.value);
      localStorage.setItem('queueMaxLength', maxQueueInput.value);
      modal.style.display = 'none';
      window.chatUI.addSystemMessage('Queue settings saved.');
    });
  }
  
  document.addEventListener('DOMContentLoaded', setupQueueSettingsModal);
  
  window.queueSettings = {
    // Expose functionality if needed in the future
  };
})();