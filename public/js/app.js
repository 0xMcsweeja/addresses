document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const form = document.getElementById('generator-form');
  const generateBtn = document.getElementById('generate-btn');
  const stopBtn = document.getElementById('stop-btn');
  const initialStatus = document.getElementById('initial-status');
  const generationStatus = document.getElementById('generation-status');
  const progressBar = document.getElementById('progress-bar');
  const speedValue = document.getElementById('speed-value');
  const foundAddressesContainer = document.getElementById('found-addresses-container');
  const noAddresses = document.getElementById('no-addresses');
  const exportBtn = document.getElementById('export-btn');
  const clearBtn = document.getElementById('clear-btn');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const addPatternBtn = document.getElementById('add-pattern-btn');
  const patternsContainer = document.getElementById('patterns-container');
  
  // Pattern management
  let patternCount = 1;
  
  // Add new pattern form
  addPatternBtn.addEventListener('click', () => {
    patternCount++;
    
    const newPattern = document.createElement('div');
    newPattern.className = 'pattern-item card mb-3';
    newPattern.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Pattern #${patternCount}</h6>
          <button type="button" class="btn btn-sm btn-outline-danger remove-pattern">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="row">
          <div class="col-md-4">
            <div class="mb-2">
              <label class="form-label">Prefix</label>
              <input type="text" class="form-control pattern-prefix" placeholder="e.g. 000">
            </div>
          </div>
          <div class="col-md-4">
            <div class="mb-2">
              <label class="form-label">Suffix</label>
              <input type="text" class="form-control pattern-suffix" placeholder="e.g. fff">
            </div>
          </div>
          <div class="col-md-4">
            <div class="mb-2">
              <label class="form-label">Contains</label>
              <input type="text" class="form-control pattern-contains" placeholder="e.g. cafe">
            </div>
          </div>
        </div>
      </div>
    `;
    
    patternsContainer.appendChild(newPattern);
    
    // Add event listener to the remove button
    const removeBtn = newPattern.querySelector('.remove-pattern');
    removeBtn.addEventListener('click', () => {
      patternsContainer.removeChild(newPattern);
      updatePatternNumbers();
    });
  });
  
  // Function to update pattern numbers after removal
  function updatePatternNumbers() {
    const patterns = patternsContainer.querySelectorAll('.pattern-item');
    patterns.forEach((pattern, index) => {
      pattern.querySelector('h6').textContent = `Pattern #${index + 1}`;
      
      // Enable/disable remove buttons based on pattern count
      const removeBtn = pattern.querySelector('.remove-pattern');
      removeBtn.disabled = patterns.length <= 1;
    });
    
    patternCount = patterns.length;
  }
  
  // Enable/disable the first pattern's remove button based on count
  updatePatternNumbers();

  // Performance chart
  const ctx = document.getElementById('speed-chart').getContext('2d');
  const speedChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Addresses per second',
        data: [],
        borderColor: '#007bff',
        tension: 0.1,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  // Socket connection
  const socket = io();
  let foundAddresses = [];
  let isGenerating = false;
  
  // Request existing addresses on load
  fetch('/api/addresses')
    .then(response => response.json())
    .then(data => {
      if (data.addresses && data.addresses.length > 0) {
        foundAddresses = data.addresses;
        displaySavedAddresses(foundAddresses);
        exportBtn.disabled = false;
        clearBtn.disabled = false;
      }
    })
    .catch(err => console.error('Error loading saved addresses:', err));

  // Function to display a list of addresses
  function displaySavedAddresses(addresses) {
    if (addresses.length === 0) return;
    
    // Clear container but keep existing addresses
    if (foundAddressesContainer.contains(noAddresses)) {
      foundAddressesContainer.removeChild(noAddresses);
    }
    
    // Add each address to the display
    addresses.forEach((data, index) => {
      // Create address element
      const addressElement = document.createElement('div');
      addressElement.className = 'found-address';
      
      addressElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <h6 class="mb-0">Address #${index + 1}</h6>
          <button class="btn btn-sm btn-outline-secondary copy-address" data-address="${data.address}">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
        <div class="address-container mt-2">
          ${data.address}
        </div>
        <div class="private-key-container">
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted">Private Key (keep this secret!)</small>
            <button class="btn btn-sm btn-outline-warning copy-key" data-key="${data.privateKey}">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
          ${data.privateKey}
        </div>
      `;
      
      // Add to container
      foundAddressesContainer.appendChild(addressElement);
      
      // Add event listeners for copy buttons
      const copyAddrBtn = addressElement.querySelector('.copy-address');
      const copyKeyBtn = addressElement.querySelector('.copy-key');
      
      copyAddrBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.address);
        copyAddrBtn.innerHTML = '<i class="bi bi-check"></i>';
        setTimeout(() => {
          copyAddrBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
        }, 2000);
      });
      
      copyKeyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.privateKey);
        copyKeyBtn.innerHTML = '<i class="bi bi-check"></i>';
        setTimeout(() => {
          copyKeyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
        }, 2000);
      });
    });
  }

  // Form submission (start generation)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (isGenerating) {
      return;
    }
    
    // Reset UI for new generation but keep existing addresses
    progressBar.style.width = '0%';
    speedChart.data.labels = [];
    speedChart.data.datasets[0].data = [];
    speedChart.update();
    
    // Check which tab is active
    const activeTabId = document.querySelector('.nav-link.active').getAttribute('id');
    let searchParams = {};
    
    // Get common form values
    const caseInsensitive = document.getElementById('case-insensitive').checked;
    const numAddresses = parseInt(document.getElementById('num-addresses').value);
    const selectElement = document.getElementById('num-workers');
    const workers = selectElement.value === 'auto' ? 
      navigator.hardwareConcurrency || 4 : 
      parseInt(selectElement.value);
    
    if (activeTabId === 'single-tab') {
      // Single pattern mode
      const prefix = document.getElementById('prefix').value.trim();
      const suffix = document.getElementById('suffix').value.trim();
      const contains = document.getElementById('contains').value.trim();
      
      // Validate input - at least one criteria must be set
      if (prefix === '' && suffix === '' && contains === '') {
        alert('Please set at least one search criterion (prefix, suffix, or contains)');
        return;
      }
      
      searchParams = {
        prefix,
        suffix,
        contains,
        caseInsensitive,
        num: numAddresses,
        workers,
        output: 'found_addresses.json'
      };
      
    } else {
      // Multiple patterns mode
      const patterns = patternsContainer.querySelectorAll('.pattern-item');
      
      const validPatterns = [];
      const invalidPatterns = [];
      
      patterns.forEach((pattern, index) => {
        const prefix = pattern.querySelector('.pattern-prefix').value.trim();
        const suffix = pattern.querySelector('.pattern-suffix').value.trim();
        const contains = pattern.querySelector('.pattern-contains').value.trim();
        
        if (prefix !== '' || suffix !== '' || contains !== '') {
          validPatterns.push({
            index: index + 1,
            prefix,
            suffix,
            contains
          });
        } else {
          invalidPatterns.push(index + 1);
        }
      });
      
      // Validate input - at least one pattern must have criteria
      if (validPatterns.length === 0) {
        alert('Please set at least one pattern with criteria');
        return;
      }
      
      // Warn about empty patterns
      if (invalidPatterns.length > 0) {
        const warningMsg = `Pattern ${invalidPatterns.join(', ')} ${invalidPatterns.length === 1 ? 'is' : 'are'} empty and will be ignored. Continue?`;
        if (!confirm(warningMsg)) {
          return;
        }
      }
      
      const multiplePatterns = validPatterns.map(p => ({
        prefix: p.prefix,
        suffix: p.suffix,
        contains: p.contains
      }));
      
      searchParams = {
        multiplePatterns,
        caseInsensitive,
        num: numAddresses,
        workers,
        output: 'found_addresses.json'
      };
    }
    
    // Update UI
    initialStatus.classList.add('d-none');
    generationStatus.classList.remove('d-none');
    generateBtn.classList.add('d-none');
    stopBtn.classList.remove('d-none');
    
    // Start generation
    isGenerating = true;
    socket.emit('start-generation', searchParams);
  });

  // Stop generation
  stopBtn.addEventListener('click', () => {
    if (!isGenerating) return;
    
    socket.emit('stop-generation');
  });

  // Handle preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      
      // Clear all inputs first
      document.getElementById('prefix').value = '';
      document.getElementById('suffix').value = '';
      document.getElementById('contains').value = '';
      
      // Set appropriate field based on preset
      if (preset === '000') {
        document.getElementById('prefix').value = '000';
      } else {
        document.getElementById('contains').value = preset;
      }
      
      // Check case insensitive by default for presets
      document.getElementById('case-insensitive').checked = true;
    });
  });

  // Export results
  exportBtn.addEventListener('click', () => {
    if (foundAddresses.length === 0) return;
    
    const dataStr = JSON.stringify(foundAddresses, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'vanity_addresses.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  });
  
  // Clear all addresses
  clearBtn.addEventListener('click', () => {
    if (foundAddresses.length === 0) return;
    
    if (confirm('Are you sure you want to clear all saved addresses? This cannot be undone!')) {
      // Clear addresses on the server
      fetch('/api/addresses/clear', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            foundAddresses = [];
            foundAddressesContainer.innerHTML = '';
            foundAddressesContainer.appendChild(noAddresses);
            exportBtn.disabled = true;
            clearBtn.disabled = true;
            
            // Show success message
            initialStatus.classList.remove('d-none');
            initialStatus.classList.remove('alert-primary', 'alert-danger', 'alert-warning', 'alert-success');
            initialStatus.classList.add('alert-info');
            initialStatus.innerHTML = `<strong>All addresses cleared!</strong>`;
          }
        })
        .catch(err => {
          console.error('Error clearing addresses:', err);
          alert('Failed to clear addresses. Please try again.');
        });
    }
  });

  // Socket event handlers
  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('generation-status', (data) => {
    console.log('Generation started:', data);
  });

  socket.on('progress-update', (data) => {
    // Update speed display
    speedValue.textContent = data.speed.toLocaleString();
    
    // Update chart
    if (speedChart.data.labels.length > 20) {
      speedChart.data.labels.shift();
      speedChart.data.datasets[0].data.shift();
    }
    
    const now = new Date();
    const timeLabel = now.getHours() + ':' + 
                     (now.getMinutes() < 10 ? '0' : '') + now.getMinutes() + ':' + 
                     (now.getSeconds() < 10 ? '0' : '') + now.getSeconds();
    
    speedChart.data.labels.push(timeLabel);
    speedChart.data.datasets[0].data.push(data.speed);
    speedChart.update();
  });

  socket.on('address-found', (data) => {
    // Add to our collection
    foundAddresses.push(data);
    
    // Clear container and display all addresses
    foundAddressesContainer.innerHTML = '';
    displaySavedAddresses(foundAddresses);
    
    // Update progress bar
    const progress = (data.foundCount / data.targetCount) * 100;
    progressBar.style.width = `${progress}%`;
    
    // Enable buttons
    exportBtn.disabled = false;
    clearBtn.disabled = false;
  });

  socket.on('generation-complete', (data) => {
    stopGeneration();
    
    // Update status
    initialStatus.classList.remove('d-none');
    initialStatus.classList.remove('alert-primary');
    initialStatus.classList.add('alert-success');
    initialStatus.innerHTML = `
      <strong>Generation complete!</strong><br>
      Found ${data.foundCount} addresses in ${data.attempts.toLocaleString()} attempts.
    `;
  });

  socket.on('generation-stopped', (data) => {
    stopGeneration();
    
    // Update status
    initialStatus.classList.remove('d-none');
    initialStatus.classList.remove('alert-primary');
    initialStatus.classList.add('alert-warning');
    initialStatus.innerHTML = `
      <strong>Generation stopped!</strong><br>
      Found ${foundAddresses.length} addresses before stopping.
    `;
  });

  socket.on('error', (data) => {
    console.error('Error:', data);
    stopGeneration();
    
    // Update status
    initialStatus.classList.remove('d-none');
    initialStatus.classList.remove('alert-primary');
    initialStatus.classList.add('alert-danger');
    initialStatus.innerHTML = `
      <strong>Error!</strong><br>
      ${data.message}
    `;
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    stopGeneration();
    
    // Update status
    initialStatus.classList.remove('d-none');
    initialStatus.classList.remove('alert-primary');
    initialStatus.classList.add('alert-danger');
    initialStatus.innerHTML = `
      <strong>Disconnected from server!</strong><br>
      Please refresh the page to reconnect.
    `;
  });

  // Helper function to stop generation and reset UI
  function stopGeneration() {
    isGenerating = false;
    generationStatus.classList.add('d-none');
    generateBtn.classList.remove('d-none');
    stopBtn.classList.add('d-none');
  }
});