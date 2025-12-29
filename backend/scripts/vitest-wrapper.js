#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Strip unsupported `--runInBand` (from CI) and pass remaining args to vitest CLI
const args = process.argv.slice(2).filter(a => a !== '--runInBand' && a !== '--runInBand=true' && a !== '--runInBand=false');
const cli = require.resolve('vitest/dist/cli.js');

const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' });

child.on('exit', code => process.exit(code));
