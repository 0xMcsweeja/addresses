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

// Helper to match a single pattern
function matchSinglePattern(address, pattern) {
  // Skip empty patterns (important for multi-pattern mode)
  if ((pattern.prefix === '' || pattern.prefix === undefined) && 
      (pattern.suffix === '' || pattern.suffix === undefined) && 
      (pattern.contains === '' || pattern.contains === undefined)) {
    return false;
  }

  const checkAddress = pattern.caseInsensitive ? address.toLowerCase() : address;
  const prefix = pattern.caseInsensitive && pattern.prefix ? pattern.prefix.toLowerCase() : (pattern.prefix || '');
  const suffix = pattern.caseInsensitive && pattern.suffix ? pattern.suffix.toLowerCase() : (pattern.suffix || '');
  const contains = pattern.caseInsensitive && pattern.contains ? pattern.contains.toLowerCase() : (pattern.contains || '');

  // Use stricter matching - require at least one criterion to be non-empty and matching
  const prefixMatches = prefix === '' || checkAddress.slice(2, 2 + prefix.length) === prefix;
  const suffixMatches = suffix === '' || checkAddress.slice(-suffix.length) === suffix;
  const containsMatches = contains === '' || checkAddress.includes(contains);

  // Debug logging for worker (disable in production)
  // console.log(`Checking address ${address} against pattern:`, { prefix, suffix, contains });
  // console.log(`Matches: prefix=${prefixMatches}, suffix=${suffixMatches}, contains=${containsMatches}`);

  return prefixMatches && suffixMatches && containsMatches;
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
  const batchSize = 1000; // Check addresses in batches for better reporting
  
  while (true) {
    for (let i = 0; i < batchSize; i++) {
      attempts++;
      const keypair = generateRandomKeypair();
      
      if (matchesCriteria(keypair.address, searchCriteria)) {
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