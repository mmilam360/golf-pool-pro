import { readFileSync } from 'node:fs'

const tournamentSeoPage = readFileSync('src/components/TournamentSeoPage.tsx', 'utf8')
const openPage = readFileSync('src/app/open-championship-pool/page.tsx', 'utf8')
const rbcPage = readFileSync('src/app/rbc-canadian-open-pool/page.tsx', 'utf8')

const checks = [
  [tournamentSeoPage.includes("headlineArticle = 'a'"), 'Tournament SEO page should default to article "a"'],
  [tournamentSeoPage.includes('Run {headlineArticle} {tournamentName} pool people actually check.'), 'Tournament SEO headline should use the article prop'],
  [openPage.includes('headlineArticle="an"'), 'Open Championship page should render "Run an Open Championship"'],
  [rbcPage.includes("Run an RBC Canadian Open golf pool"), 'RBC metadata should use "an RBC"'],
  [rbcPage.includes('headlineArticle="an"'), 'RBC page should render "Run an RBC Canadian Open"'],
  [rbcPage.includes('Set up an RBC Canadian Open pool'), 'RBC body copy should use "an RBC"'],
]

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message)
}

const combined = [tournamentSeoPage, openPage, rbcPage].join('\n')
for (const bad of ['Run a Open Championship', 'Run a RBC Canadian Open', 'Set up a RBC Canadian Open', 'Run a RBC Canadian Open golf pool']) {
  if (combined.includes(bad)) throw new Error(`Bad tournament SEO copy remains: ${bad}`)
}

console.log('tournament SEO copy checks passed')
