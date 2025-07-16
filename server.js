const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// API endpoint to get all saved addresses
app.get('/api/addresses', (req, res) => {
  const outputFile = 'found_addresses.json';
  let addresses = [];
  
  try {
    if (fs.existsSync(outputFile)) {
      const data = fs.readFileSync(outputFile, 'utf8');
      addresses = JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading addresses: ${err.message}`);
  }
  
  res.json({ addresses });
});

// API endpoint to clear all addresses
app.post('/api/addresses/clear', (req, res) => {
  const outputFile = 'found_addresses.json';
  
  try {
    // Create empty array file
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
    res.json({ success: true, message: 'All addresses cleared' });
  } catch (err) {
    console.error(`Error clearing addresses: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to clear addresses' });
  }
});

// API endpoint to start address generation
app.post('/api/generate', (req, res) => {
  // Simply acknowledge the request - actual work happens via websockets
  res.json({ success: true, message: 'Generation started' });
});

// Websocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  let activeWorkers = [];

  socket.on('start-generation', (params) => {
    // Stop any existing workers
    stopAllWorkers();
    
    const numWorkers = Math.min(
      parseInt(params.workers) || Math.min(4, require('os').cpus().length),
      require('os').cpus().length
    );
    
    let searchCriteria = {};
    
    // Check if using multiple patterns
    if (params.multiplePatterns && Array.isArray(params.multiplePatterns)) {
      searchCriteria = {
        multiplePatterns: params.multiplePatterns,
        caseInsensitive: params.caseInsensitive || false
      };
    } else {
      // Single pattern
      searchCriteria = {
        prefix: params.prefix || '',
        suffix: params.suffix || '',
        contains: params.contains || '',
        caseInsensitive: params.caseInsensitive || false
      };
    }
    
    const numAddresses = parseInt(params.num) || 1;
    const outputFile = params.output || 'found_addresses.json';
    
    // Initialize array for found addresses - load existing if available
    let foundAddresses = [];
    try {
      if (fs.existsSync(outputFile)) {
        const existingData = fs.readFileSync(outputFile, 'utf8');
        foundAddresses = JSON.parse(existingData);
        console.log(`Loaded ${foundAddresses.length} existing addresses from ${outputFile}`);
      }
    } catch (err) {
      console.error(`Error loading existing addresses: ${err.message}`);
      // If there's an error, start with empty array
      foundAddresses = [];
      fs.writeFileSync(outputFile, JSON.stringify(foundAddresses, null, 2));
    }
    
    // Tracking variables
    let totalAttempts = 0;
    let lastUpdateTime = Date.now();
    let foundCount = 0;
    
    // Prepare a user-friendly description of criteria for the UI
    let criteriaDescription = '';
    
    if (searchCriteria.multiplePatterns) {
      // Log details about the patterns for debugging
      console.log('Using multiple patterns:');
      searchCriteria.multiplePatterns.forEach((pattern, i) => {
        console.log(`Pattern #${i+1}:`, { 
          prefix: pattern.prefix || '(empty)', 
          suffix: pattern.suffix || '(empty)', 
          contains: pattern.contains || '(empty)'
        });
      });
      
      criteriaDescription = `${searchCriteria.multiplePatterns.length} different patterns`;
    } else {
      const parts = [];
      if (searchCriteria.prefix) parts.push(`prefix: ${searchCriteria.prefix}`);
      if (searchCriteria.suffix) parts.push(`suffix: ${searchCriteria.suffix}`);
      if (searchCriteria.contains) parts.push(`contains: ${searchCriteria.contains}`);
      criteriaDescription = parts.join(', ');
      
      // Log details about the single pattern
      console.log('Using single pattern:', { 
        prefix: searchCriteria.prefix || '(empty)', 
        suffix: searchCriteria.suffix || '(empty)', 
        contains: searchCriteria.contains || '(empty)',
        caseInsensitive: searchCriteria.caseInsensitive
      });
    }
    
    socket.emit('generation-status', {
      status: 'started',
      workers: numWorkers,
      criteria: searchCriteria,
      criteriaDescription: criteriaDescription, 
      targetCount: numAddresses
    });
    
    // Start worker threads
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path.join(__dirname, 'address-worker.js'), {
        workerData: { searchCriteria, workerId: i }
      });
      
      activeWorkers.push(worker);
      
      worker.on('message', (message) => {
        if (message.type === 'found') {
          const result = message.result;
          foundCount++;
          
          // Add to our collection
          foundAddresses.push(result);
          
          // Save to file
          fs.writeFileSync(outputFile, JSON.stringify(foundAddresses, null, 2));
          
          // Notify client
          socket.emit('address-found', {
            address: result.address,
            privateKey: result.privateKey,
            foundCount,
            targetCount: numAddresses
          });
          
          // Check if we've found enough
          if (foundCount >= numAddresses) {
            socket.emit('generation-complete', {
              foundCount,
              attempts: totalAttempts,
              file: outputFile
            });
            
            stopAllWorkers();
          }
        } else if (message.type === 'progress') {
          totalAttempts += message.attempts;
          
          // Update client periodically with progress
          const now = Date.now();
          if (now - lastUpdateTime > 1000) { // Update every second
            const duration = (now - lastUpdateTime) / 1000;
            const speed = Math.floor(message.attempts / duration);
            
            socket.emit('progress-update', {
              attempts: totalAttempts,
              speed,
              elapsed: Math.floor((now - lastUpdateTime) / 1000)
            });
            
            lastUpdateTime = now;
          }
        }
      });
      
      worker.on('error', (err) => {
        console.error(`Worker ${i} error:`, err);
        socket.emit('error', { message: `Worker error: ${err.message}` });
      });
    }
  });

  socket.on('stop-generation', () => {
    stopAllWorkers();
    socket.emit('generation-stopped', { message: 'Generation stopped by user' });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    stopAllWorkers();
  });

  function stopAllWorkers() {
    activeWorkers.forEach(worker => {
      try {
        worker.terminate();
      } catch (e) {
        console.error('Error terminating worker:', e);
      }
    });
    activeWorkers = [];
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});