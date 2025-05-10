```
██████╗ ████████╗██╗  ██╗    █████╗ ██████╗ ██████╗ ██████╗ ███████╗███████╗███████╗
██╔════╝ ╚══██╔══╝██║  ██║   ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝
█████╗      ██║   ███████║   ███████║██║  ██║██║  ██║██████╔╝█████╗  ███████╗███████╗
██╔══╝      ██║   ██╔══██║   ██╔══██║██║  ██║██║  ██║██╔══██╗██╔══╝  ╚════██║╚════██║
███████╗    ██║   ██║  ██║██╗██║  ██║██████╔╝██████╔╝██║  ██║███████╗███████║███████║
╚══════╝    ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
```

# eth address maker

yo this thing makes sweet ethereum vanity addresses. u can use it in terminal mode or with the cool web ui we added. make addresses with whatever letters or patterns u want - all works locally so ur keys stay safe

## what it does

### terminal mode
- makes addresses starting with whatever (after the 0x)
- makes addresses ending with whatever
- makes addresses with whatever text inside em
- case-sensitive or not - ur choice
- make as many as u want
- saves em to a json file

### web ui
- slick interface with realtime updates
- shows u how fast it's churning thru addresses
- use one pattern or stack multiple patterns at once
- quick buttons for popular stuff (dead, beef, cafe)
- copy addresses and keys with one click
- export everything to json
- uses all ur cpu cores for max speed

## get it running

```bash
# grab the code
git clone https://github.com/ethereum-vanity-address/generator.git
cd generator

# install stuff
npm install

# make it executable
chmod +x vanity-eth.js
```

## using it

### terminal mode

```bash
./vanity-eth.js [options]
```

### web ui

the web ui is way cooler - it's got all the features with a nice interface

fire it up:

```bash
npm run web
```

open ur browser to:

```
http://localhost:3000
```

#### web ui features

here's what makes the web ui awesome:

- **realtime generation**: watch addresses pop up as they're found
- **pattern setup**:
  - basic mode for simple searches
  - advanced mode for searching multiple patterns at once
  - case matching toggle
- **performance stuff**:
  - speed chart showing how many addresses/second
  - progress bar
  - cpu core selector
- **address handling**:
  - see all ur found addresses
  - copy addresses or keys with one click
  - export everything as json
  - clear everything with one button
- **quick patterns**: one-click buttons for:
  - "dead" addresses
  - "beef" addresses
  - "cafe" addresses
  - "000" prefix

### options for terminal mode

```
Options:
  -V, --version                  output the version number
  -p, --prefix <string>          Address starts with this prefix (after 0x) (default: "")
  -s, --suffix <string>          Address ends with this suffix (default: "")
  -c, --contains <string>        Address contains this string (default: "")
  -m, --multi-pattern <json>     JSON array of patterns to match any of, e.g. '[{"prefix":"000"},{"prefix":"abc"}]'
  -i, --case-insensitive         Case insensitive matching (default: false)
  -n, --num <number>             Number of addresses to generate (default: "1")
  -o, --output <file>            Output file path (default: "found_addresses.json")
  -w, --workers <number>         Number of worker threads (default: "1")
  -d, --display-interval <number> Progress display interval in seconds (default: "1")
  -h, --help                     display help for command
```

### examples

```bash
# make an address starting with "abc"
./vanity-eth.js --prefix abc

# make an address ending with "123"
./vanity-eth.js --suffix 123

# make an address with "cafe" in it
./vanity-eth.js --contains cafe

# make 5 addresses starting with "abc" (case doesn't matter)
./vanity-eth.js --prefix abc --case-insensitive --num 5

# make an address starting with "abc" and save it somewhere specific
./vanity-eth.js --prefix abc --output my_addresses.json

# make an address matching ANY pattern (starts with "000" OR starts with "abc")
./vanity-eth.js --multi-pattern '[{"prefix":"000"},{"prefix":"abc"}]'

# make an address with any of these words
./vanity-eth.js --multi-pattern '[{"contains":"dead"},{"contains":"beef"},{"contains":"cafe"}]' --case-insensitive
```

### common patterns

there's a shortcut script for popular patterns:

```bash
# run the pattern picker
./generate-common.js
# or
npm run common
```

pick from:
- repeating chars at start (000...)
- repeating chars at end (...000)
- words like "dead", "beef", "cafe", "1337"

## what the output looks like

everything gets saved to a json file (default: `found_addresses.json`):

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

## keeping ur stuff safe

### basic security
- never share ur private keys with anyone!!
- this tool runs everything locally - no network stuff
- for big money accounts, use a hardware wallet

### web ui security
- all processing happens on ur machine
- private keys never leave ur computer
- only performance data and public addresses go over websockets
- private keys only exist in memory and the local file
- there's warnings about key security right in the ui
- socket connections stay on localhost

### pro tips
- for super security, run this on a disconnected machine
- use a separate device for high-value wallets
- double-check addresses before using them
- clear or encrypt the json file when you're done

## performance

this thing uses Node.js worker threads to max out your cpu. by default, it uses all cores, but u can change it:

```bash
./vanity-eth.js --prefix abc --workers 4
```

## what's in the box

```
ethereum-vanity-address-generator/
├── README.md               # this file
├── vanity-eth.js           # main command line tool
├── address-worker.js       # worker thread code
├── generate-common.js      # common pattern script
├── debug-match.js          # pattern tester
├── server.js               # web server
├── found_addresses.json    # where addresses get saved
├── package.json            # dependencies
├── public/                 # web ui static files
│   ├── css/
│   │   └── style.css       # ui styles
│   └── js/
│       └── app.js          # ui code
└── views/                  # templates
    └── index.ejs           # main web page
```

## debugging

need to check if an address matches ur pattern? use this:

```bash
# test address against pattern
./debug-match.js 0xabcdef1234567890 '[{"prefix":"abc"},{"contains":"123"}]'

# test against a simple pattern
./debug-match.js 0xabcdef1234567890 '{"prefix":"abc"}'
```

## license

MIT