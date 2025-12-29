#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2).map(a => a === '--runInBand' ? '--threads=false' : a);
const cli = require.resolve('vitest/dist/cli.js');

const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' });

child.on('exit', code => process.exit(code));
