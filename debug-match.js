#!/usr/bin/env node

const { keccak256 } = require('ethereum-cryptography/keccak');
const { bytesToHex } = require('ethereum-cryptography/utils');
const chalk = require('chalk');

// Input address and patterns to check
if (process.argv.length < 3) {
  console.error('Usage: node debug-match.js <ethereum-address> "<pattern-json>"');
  console.error('Example: node debug-match.js 0x1234567890abcdef \'[{"prefix":"000"},{"contains":"cafe"}]\'');
  process.exit(1);
}

const address = process.argv[2].toLowerCase();
let patterns = [];

try {
  patterns = JSON.parse(process.argv[3]);
  if (!Array.isArray(patterns)) {
    patterns = [patterns]; // Convert single pattern to array
  }
} catch (err) {
  console.error(chalk.red(`Error parsing patterns: ${err.message}`));
  console.error(chalk.red('Please provide a valid JSON array or object'));
  process.exit(1);
}

// Helper to match a single pattern
function matchSinglePattern(address, pattern) {
  // Skip empty patterns
  if ((pattern.prefix === '' || pattern.prefix === undefined) && 
      (pattern.suffix === '' || pattern.suffix === undefined) && 
      (pattern.contains === '' || pattern.contains === undefined)) {
    return false;
  }

  const checkAddress = address.toLowerCase();
  const prefix = (pattern.prefix || '').toLowerCase();
  const suffix = (pattern.suffix || '').toLowerCase();
  const contains = (pattern.contains || '').toLowerCase();

  // Check each criterion
  const prefixMatches = prefix === '' || checkAddress.slice(2, 2 + prefix.length) === prefix;
  const suffixMatches = suffix === '' || checkAddress.slice(-suffix.length) === suffix;
  const containsMatches = contains === '' || checkAddress.includes(contains);

  return {
    matches: prefixMatches && suffixMatches && containsMatches,
    details: {
      prefixMatches,
      suffixMatches,
      containsMatches
    }
  };
}

// Display match results
console.log(chalk.blue(`Checking address: ${address}`));
console.log(chalk.blue('Pattern matches:'));

let anyMatches = false;
patterns.forEach((pattern, index) => {
  const result = matchSinglePattern(address, pattern);
  
  if (result.matches) {
    anyMatches = true;
    console.log(chalk.green(`✓ Pattern #${index + 1} MATCHES:`));
  } else {
    console.log(chalk.red(`✗ Pattern #${index + 1} DOES NOT MATCH:`));
  }
  
  // Print pattern details
  if (pattern.prefix) console.log(`  - Prefix: "${pattern.prefix}" (${result.details.prefixMatches ? 'matches' : 'does not match'})`);
  if (pattern.suffix) console.log(`  - Suffix: "${pattern.suffix}" (${result.details.suffixMatches ? 'matches' : 'does not match'})`);
  if (pattern.contains) console.log(`  - Contains: "${pattern.contains}" (${result.details.containsMatches ? 'matches' : 'does not match'})`);
  console.log();
});

console.log(anyMatches 
  ? chalk.green.bold('👍 ADDRESS MATCHES AT LEAST ONE PATTERN')
  : chalk.red.bold('👎 ADDRESS DOES NOT MATCH ANY PATTERNS'));