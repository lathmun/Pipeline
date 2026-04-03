#!/usr/bin/env node

// =============================================================================
// VERSION BUMP SCRIPT
// =============================================================================
//
// WHAT DOES THIS SCRIPT DO?
//   Updates public/version.json with a new version number and current timestamp.
//   Run it before committing to keep track of when each version was deployed.
//
// HOW TO USE:
//   node scripts/bump-version.js patch    → 1.0.0 → 1.0.1 (bug fixes)
//   node scripts/bump-version.js minor    → 1.0.0 → 1.1.0 (new features)
//   node scripts/bump-version.js major    → 1.0.0 → 2.0.0 (breaking changes)
//
// Or use the npm shortcut:
//   npm run bump:patch
//   npm run bump:minor
//   npm run bump:major
//
// WHAT HAPPENS:
//   1. Reads the current version from public/version.json
//   2. Bumps the version number based on the argument (patch/minor/major)
//   3. Updates the date and time to the current moment
//   4. Writes the updated version.json back to disk
// =============================================================================

const fs = require('fs');
const path = require('path');

// Path to the version file — lives in public/ so the frontend can fetch it
const versionFile = path.join(__dirname, '..', 'public', 'version.json');

// Read the current version.json file and parse it as JSON
let versionData;
try {
  versionData = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
} catch (err) {
  console.error('❌ Could not read or parse public/version.json');
  console.error('Make sure the file exists and contains valid JSON.');
  console.error('Example: {"version": "1.0.0", "date": "2026-01-01", "time": "12:00:00", "timestamp": "2026-01-01T12:00:00Z"}');
  process.exit(1);
}

// Get the bump type from command line argument
// process.argv[0] = "node", process.argv[1] = "script.js", process.argv[2] = the argument
const bumpType = process.argv[2];

// Show help if --help or -h is passed
if (bumpType === '--help' || bumpType === '-h') {
  console.log('Usage: node scripts/bump-version.js [patch|minor|major]');
  console.log('');
  console.log('Bump types:');
  console.log('  patch   1.0.0 → 1.0.1   (bug fixes, small changes)');
  console.log('  minor   1.0.0 → 1.1.0   (new features, no breaking changes)');
  console.log('  major   1.0.0 → 2.0.0   (breaking changes)');
  console.log('');
  console.log('npm shortcuts:');
  console.log('  npm run bump            Show current version');
  console.log('  npm run bump:patch      Bump patch version');
  console.log('  npm run bump:minor      Bump minor version');
  console.log('  npm run bump:major      Bump major version');
  process.exit(0);
}

// If no argument given, show current version and exit
if (!bumpType) {
  console.log(`Current version: v${versionData.version} (${versionData.date} ${versionData.time})`);
  process.exit(0);
}

// Split the version string "1.0.0" into three numbers [1, 0, 0]
const parts = versionData.version.split('.').map(Number);

// Validate version format — must be exactly 3 numeric parts
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`❌ Invalid version format in version.json: "${versionData.version}"`);
  console.error('Expected format: "X.Y.Z" (e.g., "1.0.0")');
  process.exit(1);
}

// Validate bump type — only patch, minor, major are allowed
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`❌ Unknown bump type: "${bumpType}"`);
  console.error('Usage: node scripts/bump-version.js [patch|minor|major]');
  process.exit(1);
}

// Bump the appropriate part based on the argument
if (bumpType === 'major') {
  // Major bump: increment first number, reset others to 0
  // Example: 1.2.3 → 2.0.0 (used for breaking changes)
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
} else if (bumpType === 'minor') {
  // Minor bump: increment second number, reset third to 0
  // Example: 1.2.3 → 1.3.0 (used for new features)
  parts[1]++;
  parts[2] = 0;
} else {
  // Patch bump: increment third number only
  // Example: 1.2.3 → 1.2.4 (used for bug fixes)
  parts[2]++;
}

// Create the current timestamp in UTC
// toISOString() gives format like "2026-04-02T14:30:00.000Z"
const now = new Date();

// Build the updated version object
versionData.version = parts.join('.');                         // e.g. "1.0.1"
versionData.date = now.toISOString().split('T')[0];            // e.g. "2026-04-02"
versionData.time = now.toISOString().split('T')[1].split('.')[0]; // e.g. "14:30:00"
versionData.timestamp = now.toISOString();                     // e.g. "2026-04-02T14:30:00.000Z"

// Write the updated version.json back to disk
// JSON.stringify with (null, 2) adds pretty formatting with 2-space indent
// The trailing \n ensures the file ends with a newline (good practice)
fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2) + '\n');

// Print confirmation to the console
console.log(`Version bumped: ${bumpType} → v${versionData.version} (${versionData.date} ${versionData.time})`);
