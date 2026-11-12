// ESC/POS ticket printing shared by the server ("Direct" printing). The print agent
// (public/print-agent/kamysoft-print-agent.js) contains the same logic in one file.
//
// Lines: { text, bold, align: 'left'|'center'|'right' } or { qr: 'data' }.
// Printers: { connection: 'network', ip, port }  -> raw TCP (usually port 9100)
//           { connection: 'windows', windowsName } -> RAW job to a Windows-installed
//                                                    (e.g. USB) printer, Windows only.
'use strict';
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const ESC = 0x1b, GS = 0x1d, DLE = 0x10, EOT = 0x04;

function qrBytes(data) {
    const d = Buffer.from(String(data), 'utf8');
    const len = d.length + 3;
    return Buffer.concat([
        Buffer.from([GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]),
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 67, 5]),
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 69, 49]),
        Buffer.from([GS, 0x28, 0x6b, len & 0xff, len >> 8, 49, 80, 48]), d,
        Buffer.from([GS, 0x28, 0x6b, 3, 0, 49, 81, 48])
    ]);
}

function ticketBytes(lines) {
    const parts = [Buffer.from([ESC, 0x40])];
    for (const l of lines || []) {
        if (l.qr) { parts.push(Buffer.from([ESC, 0x61, 1]), qrBytes(l.qr), Buffer.from('\n')); continue; }
        const align = l.align === 'center' ? 1 : l.align === 'right' ? 2 : 0;
        parts.push(Buffer.from([ESC, 0x61, align, ESC, 0x45, l.bold ? 1 : 0]));
        parts.push(Buffer.from(String(l.text || '').replace(/[^\x20-\x7E]/g, '') + '\n', 'latin1'));
        parts.push(Buffer.from([ESC, 0x45, 0]));
    }
    parts.push(Buffer.from([ESC, 0x64, 4, GS, 0x56, 66, 0]));
    return Buffer.concat(parts);
}

// Paper sensor status (DLE EOT 4). Bits 5/6 set = paper end. Returns 'ok', 'out' or
// 'unknown' (printer did not answer: many printers or interfaces don't support it).
const paperFromStatusByte = (b) => ((b & 0x60) === 0x60 ? 'out' : 'ok');

// Sends a ticket over the network. Checks the paper before printing (out of paper ->
// error, nothing sent) and after printing (paper ran out -> error, so it can be retried).
function printNetwork(printer, bytes, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: String(printer.ip).trim(), port: Number(printer.port) || 9100 });
        let stage = 'connect';
        let waitTimer = null;
        let finished = false;
        const done = (err, result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer); clearTimeout(waitTimer);
            // Close gracefully so the printer receives everything, then make sure it's gone
            try { socket.end(); } catch (e) { /* already closed */ }
            setTimeout(() => socket.destroy(), 1000).unref();
            err ? reject(err) : resolve(result);
        };
        const timer = setTimeout(() => done(new Error(`No answer from ${printer.ip}:${printer.port || 9100}`)), timeoutMs + 3000);
        const askPaper = (next) => {
            socket.write(Buffer.from([DLE, EOT, 4]));
            waitTimer = setTimeout(() => next('unknown'), 800);   // no status answer
            socket.once('data', (buf) => { clearTimeout(waitTimer); next(paperFromStatusByte(buf[buf.length - 1])); });
        };
        socket.setTimeout(timeoutMs, () => done(new Error(`No answer from ${printer.ip}:${printer.port || 9100}`)));
        socket.on('error', (err) => done(err));
        socket.on('connect', () => {
            stage = 'before';
            askPaper((before) => {
                if (before === 'out') return done(new Error('Printer is out of paper'));
                stage = 'print';
                socket.write(bytes, () => {
                    stage = 'after';
                    askPaper((after) => {
                        if (after === 'out') return done(new Error('Paper ran out while printing; check the ticket'));
                        done(null, { paperChecked: before !== 'unknown' });
                    });
                });
            });
        });
    });
}

// RAW print job to a Windows printer through the print spooler (winspool.drv)
const RAW_PRINT_PS = `param([string]$printer, [string]$file)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class KamyRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr h, int level, DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);
  public static void Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("Windows printer not found: " + printer);
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "KamySoft ticket"; di.pDataType = "RAW";
      if (StartDocPrinter(h, 1, di) == 0) throw new Exception("The printer did not accept the job (error " + Marshal.GetLastWin32Error() + ")");
      StartPagePrinter(h);
      int written;
      bool ok = WritePrinter(h, data, data.Length, out written);
      EndPagePrinter(h); EndDocPrinter(h);
      if (!ok || written != data.Length) throw new Exception("Writing to the printer failed (error " + Marshal.GetLastWin32Error() + ")");
    } finally { ClosePrinter(h); }
  }
}
"@
[KamyRawPrint]::Send($printer, [IO.File]::ReadAllBytes($file))
`;

function printWindows(printer, bytes, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        if (process.platform !== 'win32') return reject(new Error('Windows printers can only print from Windows (desktop app or print agent)'));
        const name = String(printer.windowsName || '').trim();
        if (!name) return reject(new Error('No Windows printer name set'));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kamyprint-'));
        const script = path.join(dir, 'raw-print.ps1');
        const data = path.join(dir, 'ticket.bin');
        fs.writeFileSync(script, RAW_PRINT_PS, 'utf8');
        fs.writeFileSync(data, bytes);
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-printer', name, '-file', data],
            { timeout: timeoutMs, windowsHide: true },
            (err, stdout, stderr) => {
                fs.rmSync(dir, { recursive: true, force: true });
                if (err) {
                    const msg = String(stderr || err.message).split('\n').map(s => s.trim()).find(s => /not found|did not accept|failed|Exception/i.test(s)) || err.message;
                    return reject(new Error(msg.replace(/^.*Exception[^:]*:\s*/, '').replace(/^"|"$/g, '')));
                }
                resolve({ paperChecked: false });
            });
    });
}

function printTicket(printer, lines) {
    const bytes = ticketBytes(lines);
    return printer.connection === 'windows' ? printWindows(printer, bytes) : printNetwork(printer, bytes);
}

module.exports = { ticketBytes, printNetwork, printWindows, printTicket, RAW_PRINT_PS };
