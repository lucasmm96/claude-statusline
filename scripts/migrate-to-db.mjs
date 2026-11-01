#!/usr/bin/env node
// One-shot migration: sends ~/.claude/statusline-sessions.json to the API in batches.
// Usage: node scripts/migrate-to-db.mjs [batch_size]

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const API_URL = process.env.API_URL || 'https://claude-statusline-report.vercel.app';
const API_KEY = process.env.API_KEY;
const BATCH = parseInt(process.argv[2] || '10', 10);

if (!API_KEY) {
  console.error('Error: API_KEY env var required.\nUsage: API_KEY=<key> node scripts/migrate-to-db.mjs');
  process.exit(1);
}

const filePath = join(homedir(), '.claude', 'statusline-sessions.json');
const data = JSON.parse(readFileSync(filePath, 'utf8'));
const entries = Object.entries(data.sessions || {});

console.log(`Migrating ${entries.length} sessions in batches of ${BATCH}...`);

let totalSessions = 0;
let totalEntries = 0;
let batch = 0;

for (let i = 0; i < entries.length; i += BATCH) {
  const chunk = Object.fromEntries(entries.slice(i, i + BATCH));
  const logCount = Object.values(chunk).reduce((a, s) => a + (s.log || []).length, 0);
  batch++;

  process.stdout.write(`  Batch ${batch}: ${Object.keys(chunk).length} sessions, ${logCount} log entries... `);

  const res = await fetch(`${API_URL}/api/ingest`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessions: chunk }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`FAILED (${res.status}):`, body);
    process.exit(1);
  }

  totalSessions += body.sessions_upserted || 0;
  totalEntries  += body.log_entries_inserted || 0;
  console.log(`ok (upserted: ${body.sessions_upserted}, inserted: ${body.log_entries_inserted})`);
}

console.log(`\nDone. Total: ${totalSessions} sessions, ${totalEntries} log entries.`);
