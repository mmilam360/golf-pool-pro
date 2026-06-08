import { displayTournamentName } from '../src/lib/tournament-name.ts'

function assertEqual(input, expected) {
  const actual = displayTournamentName(input)
  if (actual !== expected) throw new Error(`${input} -> ${actual}; expected ${expected}`)
}

assertEqual('the Memorial Tournament pres. by Workday', 'The Memorial Tournament')
assertEqual('the Memorial Tournament presented by Workday', 'The Memorial Tournament')
assertEqual('The Memorial Tournament Presented By Workday', 'The Memorial Tournament')
assertEqual('RBC Canadian Open presented by Something', 'RBC Canadian Open')
assertEqual('Travelers Championship - Sponsored by Acme', 'Travelers Championship')
assertEqual('PGA Championship: Presented by Example', 'PGA Championship')
assertEqual('U.S. Open powered by Example', 'U.S. Open')
assertEqual('The Sentry sponsored by X', 'The Sentry')
assertEqual('Charles Schwab Challenge hosted by X', 'Charles Schwab Challenge')
assertEqual('Rocket Classic in partnership with Brand', 'Rocket Classic')
assertEqual('The Open Championship', 'The Open Championship')
assertEqual('Masters Tournament', 'Masters Tournament')
assertEqual('the Genesis Invitational', 'The Genesis Invitational')
assertEqual('The Memorial Tournament at Muirfield Village', 'The Memorial Tournament')

console.log('Tournament name verification passed')
