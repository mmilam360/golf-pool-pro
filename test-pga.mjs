const PGA_TOUR_BASE = 'https://www.pgatour.com';
const PGA_TOUR_GRAPHQL = 'https://orchestrator.pgatour.com/graphql';

const FIELD_QUERY = `query Field($fieldId: ID!, $includeWithdrawn: Boolean, $changesOnly: Boolean) {
  field(id: $fieldId, includeWithdrawn: $includeWithdrawn, changesOnly: $changesOnly) {
    tournamentName id lastUpdated
    players { id firstName lastName displayName amateur country headshot qualifier alternate withdrawn status owgr }
  }
}`;

async function test() {
  const scheduleRes = await fetch(PGA_TOUR_BASE + '/schedule');
  const html = await scheduleRes.text();
  const m = html.match(/script[^>]+src="([^"]*\/pages\/\_app-[^"]+\.js)"/);
  const appScript = m ? m[1] : null;
  if (!appScript) { console.log('No app script'); return; }
  const scriptUrl = appScript.startsWith('http') ? appScript : PGA_TOUR_BASE + appScript;
  const scriptRes = await fetch(scriptUrl);
  const scriptText = await scriptRes.text();
  const keyMatch = scriptText.match(/"apiKey"\s*:\s*"([^"]+)"[\s\S]{0,300}?"queryEndpoint"\s*:\s*"https:\/\/orchestrator\.pgatour\.com\/graphql"/);
  const apiKey = keyMatch ? keyMatch[1] : null;
  console.log('API key:', apiKey ? 'YES (' + apiKey.slice(0,8) + '...)' : 'NO');
  if (!apiKey) return;

  const res = await fetch(PGA_TOUR_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ query: FIELD_QUERY, variables: { fieldId: 'R2026021', includeWithdrawn: false } })
  });
  const data = await res.json();
  console.log('Res status:', res.status);
  console.log('Players:', data?.data?.field?.players?.length || 0);
  if (data?.errors) console.log('Errors:', JSON.stringify(data.errors).slice(0,300));
}

test().catch(e => console.error(e));
