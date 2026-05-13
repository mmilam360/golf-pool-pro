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
}

function squareBaseUrl() {
  return process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
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

export async function createSquarePayment(input: CreateSquarePaymentInput) {
  const { accessToken, locationId } = assertSquareServerConfig()
  const amountMoney: SquareMoney = { amount: input.amountCents, currency: 'USD' }

  const response = await fetch(`${squareBaseUrl()}/v2/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2025-10-16',
    },
    body: JSON.stringify({
      source_id: input.sourceId,
      idempotency_key: input.idempotencyKey,
      amount_money: amountMoney,
      location_id: locationId,
      reference_id: input.poolId,
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
