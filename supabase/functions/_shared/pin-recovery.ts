export type PinRecoveryAction = 'request' | 'complete'

export type PinRecoveryRequest = {
  action: PinRecoveryAction
  email: string
  code?: string
  pin?: string
}

export type PinRecoveryDependencies = {
  allowAttempt: (email: string, action: PinRecoveryAction) => Promise<boolean>
  sendRecoveryCode: (email: string) => Promise<void>
  verifyRecoveryCode: (email: string, code: string) => Promise<string>
  replacePin: (profileId: string, pin: string) => Promise<void>
}

export type PinRecoveryResponse = {
  body: Record<string, string>
  status: number
}

const weakPins = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321',
])

export function parsePinRecoveryRequest(value: unknown): PinRecoveryRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const action = input.action
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if ((action !== 'request' && action !== 'complete') || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  if (action === 'request') return { action, email }

  const code = typeof input.code === 'string' ? input.code.trim() : ''
  const pin = typeof input.pin === 'string' ? input.pin.trim() : ''
  if (!/^\d{6}$/.test(code) || !/^\d{4}$/.test(pin) || weakPins.has(pin)) return null
  return { action, email, code, pin }
}

export async function processPinRecovery(
  input: unknown,
  dependencies: PinRecoveryDependencies,
): Promise<PinRecoveryResponse> {
  const request = parsePinRecoveryRequest(input)
  if (!request) return { status: 400, body: { error: 'Enter a valid email and recovery request.' } }

  let allowed: boolean
  try {
    allowed = await dependencies.allowAttempt(request.email, request.action)
  } catch {
    return { status: 503, body: { error: 'PIN recovery is temporarily unavailable. Try again later.' } }
  }
  if (!allowed) return { status: 429, body: { error: 'Too many PIN recovery attempts. Try again later.' } }

  if (request.action === 'request') {
    try {
      await dependencies.sendRecoveryCode(request.email)
      // Keep responses the same for existing and unknown accounts.
      return { status: 200, body: { message: 'If the account is registered, a recovery code has been sent.' } }
    } catch {
      return { status: 503, body: { error: 'PIN recovery is temporarily unavailable. Try again later.' } }
    }
  }

  try {
    const profileId = await dependencies.verifyRecoveryCode(request.email, request.code!)
    await dependencies.replacePin(profileId, request.pin!)
    return { status: 200, body: { success: 'true' } }
  } catch {
    return { status: 400, body: { error: 'The recovery code is invalid, expired, or already used.' } }
  }
}
