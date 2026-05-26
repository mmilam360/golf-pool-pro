import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SUPABASE_URL = 'https://yphjcjkkvvownjamhbiz.supabase.co';
const SUPABASE_KEY = readFileSync(join(homedir(), '.openclaw', '.supabase-service-key'), 'utf8').trim();
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PGA_TOUR_BASE = 'https://www.pgatour.com';
const PGA_TOUR_GRAPHQL = 'https://orchestrator.pgatour.com/graphql';
const FIELD_QUERY = `query Field($fieldId: ID!) {
  field(id: $fieldId) { tournamentName id lastUpdated
    players { id firstName lastName displayName amateur country headshot qualifier alternate withdrawn status owgr }
  }
}`;

async function getPgaApiKey() {
  const res = await fetch(PGA_TOUR_BASE + '/schedule');
  const html = await res.text();
  const m = html.match(/script[^\u003e]+src="([^"]*\/pages\/\_app-[^"]+\.js)"/);
  if (!m) return null;
  const scriptRes = await fetch(m[1].startsWith('http') ? m[1] : PGA_TOUR_BASE + m[1]);
  const text = await scriptRes.text();
  const km = text.match(/"apiKey"\s*:\s*"([^"]+)"[\s\S]{0,300}?"queryEndpoint"\s*:\s*"https:\/\/orchestrator\.pgatour\.com\/graphql"/);
  return km ? km[1] : null;
}

async function getField(apiKey, fieldId) {
  const res = await fetch(PGA_TOUR_GRAPHQL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ query: FIELD_QUERY, variables: { fieldId } })
  });
  const data = await res.json();
  return data?.data?.field?.players || [];
}

async function fixTournament(namePattern, fieldId, status) {
  console.log(`Fixing ${namePattern} (${fieldId})...`);
  const key = await getPgaApiKey();
  if (!key) { console.log('  No API key'); return; }
  const players = await getField(key, fieldId);
  console.log(`  Got ${players.length} players`);
  if (players.length === 0) return;

  const { data: tourn } = await sb.from('gpp_tournaments')
    .select('id, name, status')
    .ilike('name', '%' + namePattern + '%')
    .gte('start_date', '2026-05-01')
    .maybeSingle();
  if (!tourn) { console.log('  Tournament not found'); return; }

  const updateData = { field_json: players, updated_at: new Date().toISOString() };
  if (status) updateData.status = status;

  const { error } = await sb.from('gpp_tournaments').update(updateData).eq('id', tourn.id);
  if (error) console.log('  Update error:', error.message);
  else console.log('  Updated OK');
}

async function main() {
  await fixTournament('CJ CUP', 'R2026019', 'completed');
  await fixTournament('Charles Schwab', 'R2026021', null);

  const { data: rows } = await sb.from('gpp_tournaments')
    .select('name, status, field_json')
    .gte('start_date', '2026-05-01')
    .order('start_date');
  console.log('\n=== VERIFICATION ===');
  for (const r of rows || []) {
    if (r.name?.includes('CJ') || r.name?.includes('Schwab')) {
      console.log(r.name, '|', r.status, '| field:', r.field_json?.length || 0);
    }
  }
}

main().catch(e => console.error(e));
