import { existsSync, readFileSync } from 'node:fs'

const layout = readFileSync('src/app/(app)/layout.tsx', 'utf8')

const checks = [
  [layout.includes("import { Suspense } from 'react'"), 'App layout should import Suspense'],
  [layout.includes("export const dynamic = 'force-dynamic'"), 'Authenticated app layout should remain dynamic after moving blocking prompts behind Suspense'],
  [layout.includes('function AppLayout(') && !layout.includes('export default async function AppLayout'), 'App layout should not block the whole shell on reminder/profile queries'],
  [layout.includes('async function AppShellPrompts()'), 'App shell prompts should stay in an async island'],
  [layout.includes('<Suspense fallback={null}>') && layout.includes('<AppShellPrompts />'), 'App shell prompts should stream behind Suspense'],
  [existsSync('src/app/(app)/pool/create/loading.tsx'), 'Create pool route should have a loading skeleton'],
  [existsSync('src/app/(app)/pool/join/loading.tsx'), 'Join pool route should have a loading skeleton'],
]

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message)
}

console.log('app navigation responsiveness checks passed')
