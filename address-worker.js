const { randomBytes } = require('crypto');
const { bytesToHex } = require('ethereum-cryptography/utils');
const { keccak256 } = require('ethereum-cryptography/keccak');
const { secp256k1 } = require('ethereum-cryptography/secp256k1');
const { parentPort, workerData } = require('worker_threads');

const { searchCriteria, workerId } = workerData;

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

// Fast pre-check for pattern matching before expensive operations
function fastPatternPreCheck(privateKeyBytes, criteria) {
  // For very specific patterns, we can do a quick probability check
  // Skip if pattern is too complex or requires full address generation
  if (criteria.multiplePatterns) {
    // Multiple patterns always need full generation
    return true;
  }
  
  // For simple prefix patterns, we can sometimes skip based on private key
  if (criteria.prefix && criteria.prefix.length >= 6) {
    // Very specific prefixes are rare, generate anyway
    return true;
  }
  
  // For most cases, proceed with full generation
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

// Start generating and checking addresses
function generateAndCheck() {
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
            foundAtAttempt: attempts,
            timestamp: new Date().toISOString()
          }
        });
      }
    }
    
    // Report progress regularly
    parentPort.postMessage({ 
      type: 'progress', 
      attempts: batchSize,
      workerId
    });
  }
}

// Start the generation process
generateAndCheck();