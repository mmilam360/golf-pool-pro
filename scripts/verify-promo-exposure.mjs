import { readFileSync } from 'node:fs'

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`${label} missing expected text: ${needle}`)
}

function assertNotIncludes(source, needle, label) {
  if (source.includes(needle)) throw new Error(`${label} still includes blocked text: ${needle}`)
}

const signup = readFileSync('src/app/(auth)/signup/page.tsx', 'utf8')
const firstPool = readFileSync('src/app/first-pool-9/page.tsx', 'utf8')
const banner = readFileSync('src/components/ClaimedPromoBanner.tsx', 'utf8')
const claimRoute = readFileSync('src/app/api/promos/claim/route.ts', 'utf8')
const promoCodeRoute = readFileSync('src/app/api/payments/promo-code/route.ts', 'utf8')
const createPaymentRoute = readFileSync('src/app/api/payments/square/create-payment/route.ts', 'utf8')

assertIncludes(signup, "defaultPromoCode = '', promoSource = ''", 'signup props')
assertIncludes(signup, "if (!defaultPromoCode) return ''", 'signup promo gate')
assertIncludes(signup, "params.get('promo') || defaultPromoCode", 'campaign signup promo fallback')
assertIncludes(signup, "params.set('promoSource', promoSource)", 'dashboard promo source redirect')
assertNotIncludes(signup, "setSignupPromoCode(params.get('promo') || defaultPromoCode)", 'main signup promo display')
assertNotIncludes(signup, "const promoParam = params.get('promo') || signupPromoCode", 'main signup redirect promo')

assertIncludes(firstPool, 'defaultPromoCode="FIRSTPOOL9" promoSource="first-pool-9"', 'first-pool campaign signup')
assertIncludes(banner, "const promoSource = params.get('promoSource')", 'promo source read')
assertIncludes(banner, 'const request = promoCode && promoSource', 'promo source required')
assertNotIncludes(banner, "body: JSON.stringify({ promoCode, source: 'signup-link' })", 'unscoped signup-link promo claim')

assertIncludes(claimRoute, "promoCode === 'FIRSTPOOL9' && claimSource !== 'first-pool-9'", 'FIRSTPOOL9 claim source gate')
assertIncludes(promoCodeRoute, "promo.code === 'FIRSTPOOL9'", 'FIRSTPOOL9 manual promo gate')
assertIncludes(promoCodeRoute, "from('gpp_user_promo_claims')", 'FIRSTPOOL9 manual promo claim lookup')
assertIncludes(createPaymentRoute, "promoRow.code === 'FIRSTPOOL9'", 'FIRSTPOOL9 payment gate')
assertIncludes(createPaymentRoute, "from('gpp_user_promo_claims')", 'FIRSTPOOL9 payment claim lookup')

console.log('promo exposure checks passed')
