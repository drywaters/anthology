#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');

// Pin to a known working version for reproducibility.
// Override if needed (for example, to test an upgrade): PLAYWRIGHT_CLI_PKG='@playwright/cli@0.1.1'
const PLAYWRIGHT_CLI_PKG = process.env.PLAYWRIGHT_CLI_PKG || '@playwright/cli@0.1.0';

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h' || arg === '--help') {
            out.help = true;
            continue;
        }
        if (!arg.startsWith('--')) continue;

        const eq = arg.indexOf('=');
        if (eq !== -1) {
            const key = arg.slice(2, eq);
            const value = arg.slice(eq + 1);
            out[key] = value;
            continue;
        }

        const key = arg.slice(2);
        const next = argv[i + 1];
        // Treat empty string ("") as a valid value. Only omit a value when the arg is truly absent.
        if (next !== undefined && !next.startsWith('--')) {
            out[key] = next;
            i++;
        } else {
            out[key] = true;
        }
    }
    return out;
}

function printHelp() {
    console.log(`auth-capture

Open a headed browser, let you log in manually, then save Playwright storageState.

Usage:
  node scripts/auth-capture.js
  node scripts/auth-capture.js --config auth.config.json
  node scripts/auth-capture.js --appName anthology --baseURL http://localhost:4200 --loginURL /login

Writes:
  ./.auth/<appName>.json

Options:
  --config <path>     Config file path (default: auth.config.json)
  --appName <name>    App name (overrides config)
  --baseURL <url>     Base URL (overrides config)
  --loginURL <url>    Login URL (optional; overrides config; can be relative)
  --print-config      Print resolved config and exit
  -h, --help          Show help
`);
}

function readJSON(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function isAbsoluteURL(value) {
    return /^https?:\/\//i.test(value);
}

function resolveURL(baseURL, maybeURL) {
    if (!maybeURL) return baseURL;
    if (isAbsoluteURL(maybeURL)) return maybeURL;
    return new URL(maybeURL, baseURL).toString();
}

function sanitizeFileStem(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function runPlaywrightCLI(args) {
    const result = spawnSync('npx', ['--yes', '--package', PLAYWRIGHT_CLI_PKG, 'playwright-cli', ...args], {
        stdio: 'inherit',
        env: process.env,
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function openPlaywrightCLI(args) {
    // Launch in the background so we can still read from stdin for the "Press Enter" prompt.
    // We intentionally ignore stdin so the user can interact with this script while the browser is open.
    const child = spawn('npx', ['--yes', '--package', PLAYWRIGHT_CLI_PKG, 'playwright-cli', ...args], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: process.env,
    });
    return child;
}

function bestEffortChmod(targetPath, mode) {
    try {
        fs.chmodSync(targetPath, mode);
    } catch {
        // Best effort only (may fail on some filesystems).
    }
}

function bestEffortGitIgnoreCheck(targetPath) {
    try {
        const result = spawnSync('git', ['check-ignore', '-q', targetPath], { stdio: 'ignore' });
        if (result.status === 0) return true; // ignored
        if (result.status === 1) return false; // not ignored
        return null; // unknown / error
    } catch {
        return null;
    }
}

async function waitForEnter(prompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise((resolve) => rl.question(prompt, resolve));
    rl.close();
}

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise
            .then((v) => {
                clearTimeout(t);
                resolve(v);
            })
            .catch((e) => {
                clearTimeout(t);
                reject(e);
            });
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        return;
    }

    const configPath = path.resolve(process.cwd(), String(args.config || 'auth.config.json'));
    if (!fs.existsSync(configPath)) {
        console.error(`Missing config file: ${configPath}`);
        console.error('Create auth.config.json or pass --config <path>.');
        process.exit(1);
    }

    const config = readJSON(configPath);

    const appName = String((args.appName !== undefined ? args.appName : config.appName) ?? '').trim();
    const baseURL = String((args.baseURL !== undefined ? args.baseURL : config.baseURL) ?? '').trim();
    const loginURL = String((args.loginURL !== undefined ? args.loginURL : config.loginURL) ?? '').trim();

    if (!appName) {
        console.error('appName is required (set in auth.config.json or pass --appName).');
        process.exit(1);
    }
    if (!baseURL) {
        console.error('baseURL is required (set in auth.config.json or pass --baseURL).');
        process.exit(1);
    }

    const startURL = resolveURL(baseURL, loginURL);
    const stateDir = path.resolve(process.cwd(), '.auth');
    // Create with restrictive permissions; also chmod in case it already existed with wider perms.
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    bestEffortChmod(stateDir, 0o700);

    const fileStem = sanitizeFileStem(appName) || 'app';
    const statePath = path.join(stateDir, `${fileStem}.json`);
    const sessionName = `auth-${fileStem}`;

    console.log(`Config: ${configPath}`);
    console.log(`App: ${appName}`);
    console.log(`Base URL: ${baseURL}`);
    console.log(`Start URL: ${startURL}`);
    console.log(`State file: ${statePath}`);

    const ignored = bestEffortGitIgnoreCheck(stateDir);
    if (ignored === false) {
        console.warn('WARNING: .auth/ does not appear to be gitignored. This may risk committing auth state.');
    }

    if (args['print-config']) {
        return;
    }

    if (!process.stdin.isTTY) {
        console.error('This command requires an interactive TTY (it waits for you to press Enter).');
        console.error('Run it from a normal terminal session (not a non-interactive runner).');
        process.exit(1);
    }

    console.log('');
    console.log('A browser will open in headed mode. Complete login manually.');
    console.log('When finished, return to this terminal and press Enter to save the authenticated state.');
    console.log('');

    // Launch headed browser and navigate to start URL (non-blocking).
    const openChild = openPlaywrightCLI(['--session', sessionName, 'open', startURL, '--headed', '--browser', 'chrome']);
    const openExit = new Promise((resolve) =>
        openChild.once('exit', (code, signal) => resolve({ code: code ?? 0, signal: signal ?? null })),
    );

    // If the browser session exits before we capture state, fail fast.
    const raced = await Promise.race([openExit.then((v) => ({ type: 'exit', ...v })), waitForEnter('Press Enter to save storageState (cookies + localStorage) ... ').then(() => ({ type: 'enter' }))]);
    if (raced.type === 'exit') {
        console.error('');
        console.error(`Browser session exited before capture (code=${raced.code}${raced.signal ? ` signal=${raced.signal}` : ''}).`);
        console.error('Re-run the command and keep the browser window open until after storageState is saved.');
        process.exit(1);
    }

    // Save storage state for reuse by agents/tests.
    runPlaywrightCLI(['--session', sessionName, 'state-save', statePath]);
    bestEffortChmod(statePath, 0o600);

    // Close the browser session to avoid zombie processes.
    runPlaywrightCLI(['--session', sessionName, 'close']);
    try {
        await withTimeout(openExit, 5000);
    } catch {
        // Best effort cleanup: ask the child to terminate if it didn't exit after session close.
        try {
            openChild.kill('SIGTERM');
        } catch {
            // ignore
        }
    }

    console.log('');
    console.log(`Saved: ${statePath}`);
    console.log('To refresh, re-run this command and overwrite the file.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
