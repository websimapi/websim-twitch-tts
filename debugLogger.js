(function() {
  // Debug levels with corresponding colors
  const DEBUG_LEVELS = {
    INFO: { name: 'INFO', color: '#28a745' },
    WARN: { name: 'WARN', color: '#ffc107' },
    ERROR: { name: 'ERROR', color: '#dc3545' },
    DEBUG: { name: 'DEBUG', color: '#17a2b8' }
  };

  // Store logs in memory (limited to prevent memory issues)
  const MAX_LOGS = 1000;
  let logs = [];
  let activeFilters = {
    level: null,
    module: null,
    search: ''
  };
  
  // Module registry to keep track of all registered modules
  const modules = new Set();
  
  // Create a logger instance for a specific module
  function createLogger(moduleName) {
    modules.add(moduleName);
    
    // Update module filter options in UI
    updateModuleFilterOptions();
    
    const logger = {};
    
    Object.keys(DEBUG_LEVELS).forEach(level => {
      logger[level.toLowerCase()] = function(message, data) {
        if (typeof data === 'object') {
          try {
            data = JSON.stringify(data);
          } catch (e) {
            data = '[Object]';
          }
        }
        
        const logEntry = {
          timestamp: new Date(),
          level: level,
          module: moduleName,
          message: message,
          data: data
        };
        
        logs.unshift(logEntry);
        if (logs.length > MAX_LOGS) {
            logs.pop();
        }
        
        // Only update UI if debug panel is open
        if (window.debugPanelOpen) {
          renderLogs();
        }
        
        // Also log to console for easier development
        const consoleMethod = level.toLowerCase() === 'info' ? 'log' : level.toLowerCase();
        if (console[consoleMethod]) {
          console[consoleMethod](`[${moduleName}] ${message}`, data ? data : '');
        } else {
          console.log(`[${level}][${moduleName}] ${message}`, data ? data : '');
        }
      };
    });
    
    return logger;
  }
  
  function updateModuleFilterOptions() {
    const moduleSelect = document.getElementById('debug-module-filter');
    if (!moduleSelect) return;
    
    const currentValue = moduleSelect.value;
    moduleSelect.innerHTML = '<option value="">All Modules</option>';
    
    Array.from(modules).sort().forEach(module => {
      const option = document.createElement('option');
      option.value = module;
      option.textContent = module;
      moduleSelect.appendChild(option);
    });
    
    moduleSelect.value = currentValue;
  }
  
  function applyFilters() {
    activeFilters = {
      level: document.getElementById('debug-level-filter').value,
      module: document.getElementById('debug-module-filter').value,
      search: document.getElementById('debug-search-filter').value.toLowerCase()
    };
    renderLogs();
  }
  
  function clearLogs() {
    logs = [];
    renderLogs();
  }
  
  function renderLogs() {
    const logContainer = document.getElementById('debug-log-entries');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    const filteredLogs = logs.filter(log => {
      if (activeFilters.level && log.level !== activeFilters.level) return false;
      if (activeFilters.module && log.module !== activeFilters.module) return false;
      if (activeFilters.search && !log.message.toLowerCase().includes(activeFilters.search) && 
          !(log.data && log.data.toLowerCase().includes(activeFilters.search))) return false;
      return true;
    });
    
    if (filteredLogs.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'debug-empty-message';
      emptyMessage.textContent = activeFilters.level || activeFilters.module || activeFilters.search ? 
        'No logs match the current filters' : 'No logs recorded yet';
      logContainer.appendChild(emptyMessage);
      return;
    }
    
    filteredLogs.forEach(log => {
      const logEntry = document.createElement('div');
      logEntry.className = 'debug-log-entry';
      
      const time = document.createElement('span');
      time.className = 'debug-log-time';
      time.textContent = log.timestamp.toLocaleTimeString();
      
      const level = document.createElement('span');
      level.className = 'debug-log-level';
      level.style.backgroundColor = DEBUG_LEVELS[log.level].color;
      level.textContent = log.level;
      
      const module = document.createElement('span');
      module.className = 'debug-log-module';
      module.textContent = log.module;
      
      const message = document.createElement('span');
      message.className = 'debug-log-message';
      message.textContent = log.message;
      
      logEntry.appendChild(time);
      logEntry.appendChild(level);
      logEntry.appendChild(module);
      logEntry.appendChild(message);
      
      if (log.data) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'debug-expand-btn';
        expandBtn.textContent = '+';
        expandBtn.onclick = function() {
          dataContainer.style.display = dataContainer.style.display === 'none' ? 'block' : 'none';
          expandBtn.textContent = dataContainer.style.display === 'none' ? '+' : '-';
        };
        
        const dataContainer = document.createElement('pre');
        dataContainer.className = 'debug-log-data';
        dataContainer.style.display = 'none';
        dataContainer.textContent = log.data;
        
        logEntry.appendChild(expandBtn);
        logEntry.appendChild(dataContainer);
      }
      
      logContainer.appendChild(logEntry);
    });
    
    // Update counts
    document.getElementById('debug-log-count').textContent = `${filteredLogs.length} logs (${logs.length} total)`;
  }
  
  function toggleDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (!panel) return;
    
    window.debugPanelOpen = !window.debugPanelOpen;
    panel.style.display = window.debugPanelOpen ? 'block' : 'none';
    
    if (window.debugPanelOpen) {
      renderLogs();
      updateModuleFilterOptions();
    }
  }
  
  function setupDebugPanel() {
    // Create debug panel toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'debug-toggle-btn';
    toggleBtn.textContent = 'Debug';
    toggleBtn.onclick = toggleDebugPanel;
    document.body.appendChild(toggleBtn);
    
    window.debugPanelOpen = false;
  }
  
  // Expose the API globally
  window.debugLogger = {
    createLogger,
    clearLogs,
    toggleDebugPanel
  };
  
  document.addEventListener('DOMContentLoaded', () => {
    setupDebugPanel();
    
    // Setup event listeners for filters
    document.getElementById('debug-level-filter')?.addEventListener('change', applyFilters);
    document.getElementById('debug-module-filter')?.addEventListener('change', applyFilters);
    document.getElementById('debug-search-filter')?.addEventListener('input', applyFilters);
    document.getElementById('debug-clear-btn')?.addEventListener('click', clearLogs);
    document.getElementById('debug-close-btn')?.addEventListener('click', toggleDebugPanel);
    document.getElementById('debug-export-btn')?.addEventListener('click', () => {
      const logText = logs.map(log => 
        `[${log.timestamp.toISOString()}] [${log.level}] [${log.module}] ${log.message}${log.data ? ' ' + log.data : ''}`
      ).join('\n');
      
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-logs-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });
})();