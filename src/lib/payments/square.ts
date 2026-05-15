type SquareMoney = {
  amount: number
  currency: 'USD'
}

type CreateSquarePaymentInput = {
  sourceId: string
  idempotencyKey: string
  amountCents: number
  poolId: string
  poolName: string
  customerId?: string | null
}

type CreateSquareCustomerInput = {
  idempotencyKey: string
  userId: string
  email?: string | null
  displayName?: string | null
}

type CreateSquareCardInput = {
  idempotencyKey: string
  sourceId: string
  customerId: string
  cardholderName?: string | null
}

function squareBaseUrl() {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

function squareHeaders(accessToken: string) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': '2025-10-16',
  }
}

export function getSquareBrowserConfig() {
  return {
    applicationId: process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || '',
    locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION_ID || '',
    environment: process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || process.env.SQUARE_ENVIRONMENT || 'sandbox',
  }
}

export function assertSquareServerConfig() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID

  if (!accessToken || !locationId) {
    throw new Error('Square is not configured')
  }

  return { accessToken, locationId }
}

export async function createSquareCustomer(input: CreateSquareCustomerInput) {
  const { accessToken } = assertSquareServerConfig()
  const names = (input.displayName || '').trim().split(/\s+/).filter(Boolean)
  const response = await fetch(`${squareBaseUrl()}/v2/customers`, {
    method: 'POST',
    headers: squareHeaders(accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      given_name: names[0] || undefined,
      family_name: names.length > 1 ? names.slice(1).join(' ') : undefined,
      email_address: input.email || undefined,
      reference_id: input.userId,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = Array.isArray(data.errors) ? data.errors.map((err: any) => err.detail || err.code).join('; ') : 'Square customer failed'
    throw new Error(detail || 'Square customer failed')
  }

  return data.customer
}

export async function createSquareCard(input: CreateSquareCardInput) {
  const { accessToken } = assertSquareServerConfig()
  const response = await fetch(`${squareBaseUrl()}/v2/cards`, {
    method: 'POST',
    headers: squareHeaders(accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.sourceId,
      card: {
        customer_id: input.customerId,
        cardholder_name: input.cardholderName || undefined,
      },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = Array.isArray(data.errors) ? data.errors.map((err: any) => err.detail || err.code).join('; ') : 'Card could not be saved'
    throw new Error(detail || 'Card could not be saved')
  }

  return data.card
}

export async function createSquarePayment(input: CreateSquarePaymentInput) {
  const { accessToken, locationId } = assertSquareServerConfig()
  const amountMoney: SquareMoney = { amount: input.amountCents, currency: 'USD' }

  const response = await fetch(`${squareBaseUrl()}/v2/payments`, {
    method: 'POST',
    headers: squareHeaders(accessToken),
    body: JSON.stringify({
      source_id: input.sourceId,
      idempotency_key: input.idempotencyKey,
      amount_money: amountMoney,
      location_id: locationId,
      reference_id: input.poolId,
      customer_id: input.customerId || undefined,
      note: 'Golf Pools Pro activation',
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = Array.isArray(data.errors) ? data.errors.map((err: any) => err.detail || err.code).join('; ') : 'Square payment failed'
    throw new Error(detail || 'Square payment failed')
  }

  return data.payment
}
