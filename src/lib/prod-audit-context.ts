import type { ProdReadinessIssue } from './prod-readiness'

export type BrowserSupabaseContext = {
  supabaseUrl: string
  anonKey: string
}

export function hostFromUrl(value?: string | null) {
  if (!value) return ''
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return String(value).replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
  }
}

export function decodeJwtPayload(token: string) {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export function findAnonJwt(text: string) {
  const tokens = text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []
  return tokens.find(token => decodeJwtPayload(token)?.role === 'anon') || ''
}

export function extractBrowserSupabaseContext(text: string): BrowserSupabaseContext | null {
  const url = text.match(/https:\/\/[^"'`\\\s]*supabase[^"'`\\\s]+/i)?.[0] || ''
  const anonKey = findAnonJwt(text)
  return url && anonKey ? { supabaseUrl: url, anonKey } : null
}

export function supabaseContextMismatchIssue(configuredUrl: string, liveUrl: string): ProdReadinessIssue | null {
  const configuredHost = hostFromUrl(configuredUrl)
  const liveHost = hostFromUrl(liveUrl)
  if (!configuredHost || !liveHost || configuredHost === liveHost) return null
  return {
    severity: 'critical',
    code: 'AUDIT_SUPABASE_CONTEXT_MISMATCH',
    message: 'Audit Supabase URL does not match the live app Supabase URL; readiness results may be checking the wrong database.',
    details: { configuredHost, liveHost },
  }
}
