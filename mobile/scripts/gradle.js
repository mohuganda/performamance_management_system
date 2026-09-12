#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const cmd = isWin ? 'gradlew.bat' : './gradlew';
const androidDir = path.resolve(__dirname, '..', 'android');
const args = process.argv.slice(2);

const proc = spawn(cmd, args, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});

proc.on('error', (err) => {
  console.error('Failed to start gradle wrapper:', err);
  process.exit(1);
});
