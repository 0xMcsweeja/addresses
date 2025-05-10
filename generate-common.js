#!/usr/bin/env node

const { spawn } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue.bold('Ethereum Common Vanity Address Generator'));
console.log(chalk.gray('This script generates common vanity address patterns\n'));

const patterns = [
  { name: 'Repeating characters at start', args: ['--prefix', '000'] },
  { name: 'Repeating characters at end', args: ['--suffix', '000'] },
  { name: 'Contains "dead"', args: ['--contains', 'dead'] },
  { name: 'Contains "beef"', args: ['--contains', 'beef'] },
  { name: 'Contains "cafe"', args: ['--contains', 'cafe'] },
  { name: 'Contains "1337"', args: ['--contains', '1337'] },
  { name: 'Multiple prefixes (000 OR abc)', args: ['--multi-pattern', '[{"prefix":"000"},{"prefix":"abc"}]'] },
  { name: 'Common words (dead OR beef OR cafe)', args: ['--multi-pattern', '[{"contains":"dead"},{"contains":"beef"},{"contains":"cafe"}]'] },
];

console.log(chalk.yellow('Choose a pattern to generate:'));
patterns.forEach((pattern, index) => {
  console.log(`${index + 1}. ${pattern.name} (${pattern.args.join(' ')})`);
});

process.stdout.write(`\nEnter number (1-${patterns.length}): `);

process.stdin.on('data', (data) => {
  const choice = parseInt(data.toString().trim(), 10);
  
  if (isNaN(choice) || choice < 1 || choice > patterns.length) {
    console.log(chalk.red(`Invalid choice. Please enter a number between 1 and ${patterns.length}.`));
    process.exit(1);
  }
  
  const selectedPattern = patterns[choice - 1];
  console.log(chalk.green(`\nGenerating addresses with pattern: ${selectedPattern.name}`));
  
  // Run the vanity-eth.js script with selected pattern
  const args = [...selectedPattern.args, '--num', '1', '--case-insensitive'];
  
  console.log(chalk.gray(`Running command: ./vanity-eth.js ${args.join(' ')}\n`));
  
  const vanityProcess = spawn('./vanity-eth.js', args, { stdio: 'inherit' });
  
  vanityProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`Process exited with code ${code}`));
    }
  });
  
  process.exit();
});