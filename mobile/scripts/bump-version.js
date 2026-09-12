#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const androidGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const iosPlistPath = path.join(rootDir, 'ios', 'mobile', 'Info.plist');

// ---- CONFIG ----
const bumpType = process.argv[2] || 'patch'; // patch | minor | major

// ---- STEP 1: READ CURRENT VERSION ----
if (!fs.existsSync(pkgPath)) {
  console.error('Error: package.json not found at ' + pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '1.0.0';
console.log(`Current version: ${currentVersion}`);

// ---- STEP 2: INCREMENT VERSION (SEMVER) ----
let [major, minor, patch] = currentVersion.split('.').map(Number);
major = isNaN(major) ? 1 : major;
minor = isNaN(minor) ? 0 : minor;
patch = isNaN(patch) ? 0 : patch;

if (bumpType === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bumpType === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`New version: ${newVersion}`);

// ---- STEP 3: WRITE BACK TO package.json ----
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// ---- STEP 4: BUILD NUMBER ----
const buildNumber = process.env.BUILD_NUMBER || Math.floor(Date.now() / 1000).toString();
console.log(`Build number: ${buildNumber}`);

// ---- STEP 5: UPDATE ANDROID ----
if (fs.existsSync(androidGradlePath)) {
  let gradleContent = fs.readFileSync(androidGradlePath, 'utf8');
  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`);
  gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
  fs.writeFileSync(androidGradlePath, gradleContent, 'utf8');
  console.log('Android updated');
}

// ---- STEP 6: UPDATE iOS ----
if (fs.existsSync(iosPlistPath)) {
  let plistContent = fs.readFileSync(iosPlistPath, 'utf8');
  plistContent = plistContent.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${newVersion}$2`
  );
  plistContent = plistContent.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${buildNumber}$2`
  );
  fs.writeFileSync(iosPlistPath, plistContent, 'utf8');
  console.log('iOS updated');
}

console.log(`Done: ${newVersion} (${buildNumber})`);
