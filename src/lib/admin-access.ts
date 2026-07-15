const BUILT_IN_ADMIN_USER_IDS = ['3e524081-47bd-40e8-81ab-99e962fed992']
const BUILT_IN_ADMIN_EMAILS = ['mmilam360@gmail.com']

function envList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
}

export type AdminUserLike = {
  id?: string | null
  email?: string | null
}

export function isGppAdminUser(user: AdminUserLike | null | undefined) {
  if (!user?.id) return false

  const adminUserIds = new Set([
    ...BUILT_IN_ADMIN_USER_IDS.map(id => id.toLowerCase()),
    ...envList(process.env.GPP_ADMIN_USER_IDS),
  ])
  const adminEmails = new Set([
    ...BUILT_IN_ADMIN_EMAILS,
    ...envList(process.env.GPP_ADMIN_EMAILS),
  ])

  const userId = user.id.toLowerCase()
  const email = user.email?.trim().toLowerCase() || ''

  return adminUserIds.has(userId) || (email ? adminEmails.has(email) : false)
}
