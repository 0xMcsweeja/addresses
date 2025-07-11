```
██████╗ ████████╗██╗  ██╗    █████╗ ██████╗ ██████╗ ██████╗ ███████╗███████╗███████╗
██╔════╝ ╚══██╔══╝██║  ██║   ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝
█████╗      ██║   ███████║   ███████║██║  ██║██║  ██║██████╔╝█████╗  ███████╗███████╗
██╔══╝      ██║   ██╔══██║   ██╔══██║██║  ██║██║  ██║██╔══██╗██╔══╝  ╚════██║╚════██║
███████╗    ██║   ██║  ██║██╗██║  ██║██████╔╝██████╔╝██║  ██║███████╗███████║███████║
╚══════╝    ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
```

# Ethereum Address Generator

Generate custom Ethereum vanity addresses with specific patterns. Available as both a command-line tool and a web interface. All processing happens locally for maximum security.

## Features

### Command Line
- Create addresses with custom prefixes, suffixes, or containing specific text
- Toggle case sensitivity
- Generate multiple addresses at once
- Save results to JSON

### Web Interface
- Real-time generation with live stats
- Flexible pattern matching (single or multiple patterns)
- Performance monitoring with speed charts
- One-click copy for addresses and keys
- Quick presets for popular patterns

## Quick Start

```bash
# Clone repo
git clone https://github.com/0xMcsweeja/addresses.git
cd addresses

# Install dependencies
npm install

```

## Usage

### Command Line

```bash
npm run start
```

OR

```bash
# Make executable
chmod +x vanity-eth.js

./vanity-eth.js [options]
```

### Web Interface

```bash
npm run web
```

Then visit `http://localhost:3000` in your browser.

### Command Line Options

```
Options:
  -p, --prefix <string>          Address starts with this prefix (after 0x)
  -s, --suffix <string>          Address ends with this suffix
  -c, --contains <string>        Address contains this string
  -m, --multi-pattern <json>     JSON array of patterns
  -i, --case-insensitive         Case insensitive matching
  -n, --num <number>             Number of addresses to generate (default: "1")
  -o, --output <file>            Output file path (default: "found_addresses.json")
  -w, --workers <number>         Number of worker threads
  -h, --help                     display help for command
```

### Examples

```bash
# Address starting with "abc"
./vanity-eth.js --prefix abc

# Address with "cafe" in it
./vanity-eth.js --contains cafe

# 5 addresses starting with "abc" (case-insensitive)
./vanity-eth.js --prefix abc --case-insensitive --num 5

# Address matching multiple patterns
./vanity-eth.js --multi-pattern '[{"contains":"dead"},{"contains":"beef"}]' --case-insensitive
```

For common patterns, use the interactive generator:

```bash
npm run common
```

## Output Format

Results are saved to `found_addresses.json`:

```json
[
  {
    "address": "0xabcD1234...",
    "privateKey": "0123456789abcdef...",
    "publicKey": "04abcdef...",
    "foundAtAttempt": 42315
  }
]
```

## Security

### General
- Private keys never leave your machine
- All processing is done locally
- For high-value wallets, use a hardware wallet

### Web Interface
- WebSockets only transmit performance metrics and public addresses
- Private keys exist only in local memory and storage
- UI includes visual security warnings
- Socket.io connections limited to localhost by default

### Best Practices
- For maximum security, run on an air-gapped computer
- Use a separate device for high-value wallets
- Always verify generated addresses before use
- Regularly clear or encrypt generated key files

## Performance

Uses multi-threading to maximize performance. Adjust thread count with:

```bash
./vanity-eth.js --prefix abc --workers 4
```

## Project Structure

```
ethereum-vanity-address-generator/
├── README.md               # Documentation
├── vanity-eth.js           # Main CLI tool
├── address-worker.js       # Worker thread implementation
├── generate-common.js      # Common pattern script
├── debug-match.js          # Pattern testing tool
├── server.js               # Web server
├── public/                 # Web UI assets
└── views/                  # Templates
```

## License

MIT
