#!/usr/bin/env node

const { randomBytes } = require('crypto');
const { bytesToHex } = require('ethereum-cryptography/utils');
const { keccak256 } = require('ethereum-cryptography/keccak');
const { secp256k1 } = require('ethereum-cryptography/secp256k1');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

program
  .name('vanity-eth')
  .description('Generate Ethereum vanity addresses locally')
  .version('1.0.0')
  .option('-p, --prefix <string>', 'Address starts with this prefix (after 0x)', '')
  .option('-s, --suffix <string>', 'Address ends with this suffix', '')
  .option('-c, --contains <string>', 'Address contains this string', '')
  .option('-m, --multi-pattern <json>', 'JSON array of patterns to match any of, e.g. \'[{"prefix":"000"},{"prefix":"abc"}]\'')
  .option('-i, --case-insensitive', 'Case insensitive matching', false)
  .option('-n, --num <number>', 'Number of addresses to generate', '1')
  .option('-o, --output <file>', 'Output file path', 'found_addresses.json')
  .option('-w, --workers <number>', 'Number of worker threads', String(Math.min(4, require('os').cpus().length)))
  .option('-d, --display-interval <number>', 'Progress display interval in seconds', '1')
  .parse();

const options = program.opts();

// Helper to create Ethereum address from public key
function publicKeyToAddress(publicKey) {
  // Remove the '04' prefix if it exists (uncompressed public key format)
  const pubKey = publicKey.length === 130 ? publicKey.slice(2) : publicKey;
  
  // Hash the public key and get the last 20 bytes
  const addressBuf = Buffer.from(keccak256(Buffer.from(pubKey, 'hex')).slice(-20));
  const address = '0x' + bytesToHex(addressBuf);
  
  return address.toLowerCase();
}

// Check if an address matches the criteria
function matchesCriteria(address, criteria) {
  // If we have multiplePatterns array, check if address matches any of them
  if (criteria.multiplePatterns && Array.isArray(criteria.multiplePatterns) && criteria.multiplePatterns.length > 0) {
    return criteria.multiplePatterns.some(pattern => {
      return matchSinglePattern(address, {
        prefix: pattern.prefix || '',
        suffix: pattern.suffix || '',
        contains: pattern.contains || '',
        caseInsensitive: criteria.caseInsensitive
      });
    });
  }
  
  // Otherwise check single pattern
  return matchSinglePattern(address, criteria);
}

// Helper to match a single pattern (optimized)
function matchSinglePattern(address, pattern) {
  // Skip empty patterns (important for multi-pattern mode)
  if ((pattern.prefix === '' || pattern.prefix === undefined) && 
      (pattern.suffix === '' || pattern.suffix === undefined) && 
      (pattern.contains === '' || pattern.contains === undefined)) {
    return false;
  }

  // Address is already lowercase from publicKeyToAddress
  const checkAddress = address;
  
  // Pre-computed pattern strings with case handling
  const prefix = pattern.caseInsensitive && pattern.prefix ? pattern.prefix.toLowerCase() : (pattern.prefix || '');
  const suffix = pattern.caseInsensitive && pattern.suffix ? pattern.suffix.toLowerCase() : (pattern.suffix || '');
  const contains = pattern.caseInsensitive && pattern.contains ? pattern.contains.toLowerCase() : (pattern.contains || '');

  // Early exit optimizations - check most restrictive patterns first
  if (prefix && !checkAddress.startsWith('0x' + prefix)) {
    return false;
  }
  
  if (suffix && !checkAddress.endsWith(suffix)) {
    return false;
  }
  
  if (contains && checkAddress.indexOf(contains) === -1) {
    return false;
  }

  return true;
}

// Generate a random Ethereum keypair
function generateRandomKeypair() {
  // Generate a random private key
  const privateKey = randomBytes(32);
  const privateKeyHex = bytesToHex(privateKey);
  
  // Derive public key from private key
  const publicKey = bytesToHex(secp256k1.getPublicKey(privateKeyHex, false));
  
  // Derive address from public key
  const address = publicKeyToAddress(publicKey);
  
  return {
    address,
    privateKey: privateKeyHex,
    publicKey
  };
}

// Calculate checksum address
function toChecksumAddress(address) {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = bytesToHex(keccak256(Buffer.from(addr, 'utf8')));
  let checksumAddress = '0x';
  
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addr[i].toUpperCase();
    } else {
      checksumAddress += addr[i];
    }
  }
  
  return checksumAddress;
}

// Worker thread code
if (!isMainThread) {
  const { searchCriteria } = workerData;
  
  const generateAndCheck = () => {
    let attempts = 0;
    const batchSize = 10000; // Larger batch size reduces reporting overhead for better performance
    
    while (true) {
      for (let i = 0; i < batchSize; i++) {
        attempts++;
        const keypair = generateRandomKeypair();
        
        if (matchesCriteria(keypair.address, searchCriteria)) {
          // Only generate checksum address when we have a match
          const checksumAddress = toChecksumAddress(keypair.address);
          parentPort.postMessage({
            type: 'found',
            result: {
              address: checksumAddress,
              privateKey: keypair.privateKey,
              publicKey: keypair.publicKey,
              foundAtAttempt: attempts
            }
          });
        }
      }
      
      // Report progress regularly
      parentPort.postMessage({ type: 'progress', attempts: batchSize });
    }
  };
  
  generateAndCheck();
}
// Main thread code
else {
  // Main function to find vanity addresses
  async function findVanityAddresses() {
    console.log(chalk.blue('Starting Ethereum vanity address generation...'));
    
    // Parse multiple patterns if provided
    let multiplePatterns = [];
    if (options.multiPattern) {
      try {
        multiplePatterns = JSON.parse(options.multiPattern);
        console.log(chalk.gray(`Looking for addresses matching any of these patterns:`));
        multiplePatterns.forEach((pattern, index) => {
          console.log(chalk.gray(`Pattern ${index+1}:`));
          if (pattern.prefix) console.log(chalk.gray(`  - Prefix: ${pattern.prefix}`));
          if (pattern.suffix) console.log(chalk.gray(`  - Suffix: ${pattern.suffix}`));
          if (pattern.contains) console.log(chalk.gray(`  - Contains: ${pattern.contains}`));
        });
      } catch (err) {
        console.error(chalk.red(`Error parsing multiple patterns: ${err.message}`));
        console.error(chalk.red(`Please provide a valid JSON array like: '[{"prefix":"000"},{"prefix":"abc"}]'`));
        process.exit(1);
      }
    } else {
      // Single pattern
      console.log(chalk.gray(`Looking for addresses with:`));
      if (options.prefix) console.log(chalk.gray(`- Prefix: ${options.prefix}`));
      if (options.suffix) console.log(chalk.gray(`- Suffix: ${options.suffix}`));
      if (options.contains) console.log(chalk.gray(`- Contains: ${options.contains}`));
    }
    
    if (options.caseInsensitive) console.log(chalk.gray('- Case insensitive matching enabled'));
    
    const numAddresses = parseInt(options.num);
    const numWorkers = parseInt(options.workers);
    const displayInterval = parseInt(options.displayInterval) * 1000;
    
    console.log(chalk.gray(`Using ${numWorkers} worker threads...`));
    
    const foundAddresses = [];
    let totalAttempts = 0;
    let lastDisplayTime = Date.now();
    
    // Create workers
    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          searchCriteria: {
            prefix: options.prefix,
            suffix: options.suffix,
            contains: options.contains,
            caseInsensitive: options.caseInsensitive,
            multiplePatterns: multiplePatterns.length > 0 ? multiplePatterns : undefined
          }
        }
      });
      
      workers.push(worker);
      
      worker.on('message', (message) => {
        if (message.type === 'found') {
          const result = message.result;
          console.log(chalk.green(`\n✓ Found matching address: ${result.address}`));
          console.log(chalk.yellow(`  Private Key: ${result.privateKey}`));
          
          foundAddresses.push(result);
          
          // Save to file after each successful find
          fs.writeFileSync(options.output, JSON.stringify(foundAddresses, null, 2));
          console.log(chalk.gray(`  Saved to ${options.output}`));
          
          if (foundAddresses.length >= numAddresses) {
            console.log(chalk.green(`\n\nCompleted! Found ${foundAddresses.length} addresses in ${totalAttempts.toLocaleString()} attempts.`));
            console.log(chalk.gray(`Results saved to ${options.output}`));
            
            // Terminate all workers
            workers.forEach(w => w.terminate());
            process.exit(0);
          }
        } else if (message.type === 'progress') {
          totalAttempts += message.attempts;
          
          // Display progress at set intervals
          const now = Date.now();
          if (now - lastDisplayTime > displayInterval) {
            const duration = (now - lastDisplayTime) / 1000;
            const speed = Math.floor(totalAttempts / duration);
            totalAttempts = 0;
            
            process.stdout.write(`\rChecking addresses: ${speed.toLocaleString()} addr/s`);
            lastDisplayTime = now;
          }
        }
      });
      
      worker.on('error', (err) => {
        console.error(chalk.red(`Worker error: ${err.message}`));
      });
    }
    
    // Handle Ctrl+C to gracefully exit
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nInterrupted by user. Shutting down...'));
      workers.forEach(w => w.terminate());
      console.log(chalk.gray(`Found ${foundAddresses.length} addresses. Results saved to ${options.output}`));
      process.exit(0);
    });
  }

  // Run the main function
  findVanityAddresses().catch(console.error);
}