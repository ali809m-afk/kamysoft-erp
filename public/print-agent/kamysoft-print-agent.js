#!/usr/bin/env node
/*
 * KamySoft / 26i Print Agent
 * --------------------------
 * Runs on a PC inside the restaurant and prints the kitchen tickets and receipts that the
 * website (e.g. https://mystore.26i.uk) queues for your network printers (Kitchen, Main,
 * Juice, Cashier...). The website itself cannot reach printers on your local network.
 *
 * Needs only Node.js 18+ (https://nodejs.org). No other installs.
 *
 * Start it:
 *   node kamysoft-print-agent.js --url https://mystore.26i.uk --key pa_xxxxxxxx
 * or set the environment variables PRINT_AGENT_URL and PRINT_AGENT_KEY.
 *
 * Get the key in the app: POS / Cashier > Printer Setup > Printing method > Print agent.
 * Keep this window open while the restaurant is working (or run it as a Windows service /
 * scheduled task "At log on").
 */
'use strict';
const net = require('net');
const os = require('os');

const VERSION = '1.0';
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const STORE_URL = String(arg('url') || process.env.PRINT_AGENT_URL || '').replace(/\/+$/, '');
const KEY = arg('key') || process.env.PRINT_AGENT_KEY || '';
const POLL_MS = Number(arg('poll') || process.env.PRINT_AGENT_POLL_MS) || 2000;
const PRINT_TIMEOUT_MS = 5000;

if (!STORE_URL || !KEY) {
    console.log('Usage: node kamysoft-print-agent.js --url https://mystore.26i.uk --key pa_xxxxxxxx');
    process.exit(1);
}
if (typeof fetch !== 'function') {
    console.log('This agent needs Node.js 18 or newer: https://nodejs.org');
    process.exit(1);
}

const log = (...a) => console.log(new Date().toLocaleTimeString('en-GB', { hour12: false }), ...a);
const headers = {
    'x-print-agent-key': KEY,
    'x-print-agent-info': `kamysoft-print-agent ${VERSION} on ${os.hostname()}`,
    'Content-Type': 'application/json'
};

// ---- ESC/POS ---------------------------------------------------------------------------
const ESC = 0x1b, GS = 0x1d;
function qrBytes(data) {
    const d = Buffer.from(String(data), 'utf8');
    const len = d.length + 3;
    return Buffer.concat([
        Buffer.from([GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]),          // model 2
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 67, 5]),              // module size 5
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 69, 49]),             // error correction M
        Buffer.from([GS, 0x28, 0x6b, len & 0xff, len >> 8, 49, 80, 48]), d, // store data
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 81, 48])              // print
    ]);
}
function ticketBytes(lines) {
    const parts = [Buffer.from([ESC, 0x40])]; // initialise
    for (const l of lines || []) {
        if (l.qr) {
            parts.push(Buffer.from([ESC, 0x61, 1]), qrBytes(l.qr), Buffer.from('\n'));
            continue;
        }
        const align = l.align === 'center' ? 1 : l.align === 'right' ? 2 : 0;
        parts.push(Buffer.from([ESC, 0x61, align, ESC, 0x45, l.bold ? 1 : 0]));
        parts.push(Buffer.from(String(l.text || '').replace(/[^\x20-\x7E]/g, '') + '\n', 'latin1'));
        parts.push(Buffer.from([ESC, 0x45, 0]));
    }
    parts.push(Buffer.from([ESC, 0x64, 4, GS, 0x56, 66, 0])); // feed + cut
    return Buffer.concat(parts);
}
function sendToPrinter(printer, bytes) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: printer.ip, port: Number(printer.port) || 9100 });
        const timer = setTimeout(() => { socket.destroy(); reject(new Error(`No answer from ${printer.ip}:${printer.port || 9100}`)); }, PRINT_TIMEOUT_MS);
        socket.on('connect', () => socket.end(bytes));
        socket.on('close', (hadError) => { clearTimeout(timer); if (!hadError) resolve(); });
        socket.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
}

// ---- Queue loop ------------------------------------------------------------------------
async function printJob(job) {
    const bytes = ticketBytes(job.lines);
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try { await sendToPrinter(job.printer, bytes); return { success: true }; }
        catch (err) { lastError = err; await new Promise(r => setTimeout(r, 1500)); }
    }
    return { success: false, error: lastError ? lastError.message : 'Printer did not respond' };
}

let wasOnline = null;
async function poll() {
    try {
        const res = await fetch(`${STORE_URL}/api/print-agent/jobs`, { headers });
        if (res.status === 401) { log('The print agent key was refused. Create a new key in Printer Setup.'); return 15000; }
        if (!res.ok) throw new Error(`Store answered ${res.status}`);
        if (wasOnline !== true) { log(`Connected to ${STORE_URL}. Waiting for tickets...`); wasOnline = true; }
        const { jobs = [] } = await res.json();
        for (const job of jobs) {
            const result = await printJob(job);
            const label = `${job.kind} -> ${job.printer.name || ''} (${job.printer.ip}:${job.printer.port})`;
            log(result.success ? `Printed ${label}` : `FAILED ${label}: ${result.error}`);
            await fetch(`${STORE_URL}/api/print-agent/jobs/${encodeURIComponent(job.id)}/result`, {
                method: 'POST', headers, body: JSON.stringify(result)
            }).catch(() => {});
        }
        return jobs.length ? 200 : POLL_MS;
    } catch (err) {
        if (wasOnline !== false) { log(`Cannot reach ${STORE_URL}: ${err.message}. Retrying...`); wasOnline = false; }
        return 5000;
    }
}

(async function loop() {
    log(`KamySoft Print Agent ${VERSION} starting for ${STORE_URL}`);
    for (;;) { const wait = await poll(); await new Promise(r => setTimeout(r, wait)); }
})();
