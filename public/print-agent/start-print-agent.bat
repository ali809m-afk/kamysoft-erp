@echo off
REM KamySoft / 26i Print Agent - double-click to start.
REM 1) Install Node.js 18+ from https://nodejs.org
REM 2) Put this file next to kamysoft-print-agent.js
REM 3) Replace the two values below with your store address and the key from Printer Setup
set PRINT_AGENT_URL=https://mystore.26i.uk
set PRINT_AGENT_KEY=pa_paste_your_key_here
title KamySoft Print Agent
node "%~dp0kamysoft-print-agent.js"
pause
