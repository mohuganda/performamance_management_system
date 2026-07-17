#!/bin/bash

set -e

# ---- CONFIG ----
BUMP_TYPE=${1:-patch} # patch | minor | major

# ---- STEP 1: READ CURRENT VERSION ----
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "Current version: $CURRENT_VERSION"

# ---- STEP 2: INCREMENT VERSION (SEMVER SAFE) ----
NEW_VERSION=$(node -e "
const v = require('./package.json').version.split('.');
let [major, minor, patch] = v.map(Number);

if ('$BUMP_TYPE' === 'major') {
  major++;
  minor = 0;
  patch = 0;
} else if ('$BUMP_TYPE' === 'minor') {
  minor++;
  patch = 0;
} else {
  patch++;
}

console.log([major, minor, patch].join('.'));
")

echo "New version: $NEW_VERSION"

# ---- STEP 3: WRITE BACK TO package.json ----
node -e "
const fs = require('fs');
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# ---- STEP 4: BUILD NUMBER ----
BUILD_NUMBER=${BUILD_NUMBER:-$(date +%s)}

echo "Build number: $BUILD_NUMBER"

# ---- STEP 5: UPDATE ANDROID ----
GRADLE_FILE=android/app/build.gradle

sed -i '' -E "s/versionCode[[:space:]]+[0-9]+/versionCode $BUILD_NUMBER/" $GRADLE_FILE
sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" $GRADLE_FILE

echo "Android updated"

# ---- STEP 6: UPDATE iOS ----
PLIST_FILE=ios/mobile/Info.plist

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $NEW_VERSION" $PLIST_FILE
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" $PLIST_FILE

echo "iOS updated"

echo "Done: $NEW_VERSION ($BUILD_NUMBER)"