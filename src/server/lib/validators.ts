export function validateAppName(name: string): boolean {
  return Boolean(name && name.trim().length > 0)
}

export function validateCreateAppRequest(data: Record<string, unknown>): {
  valid: boolean
  error?: string
} {
  if (!data.name) return { valid: false, error: 'name is required' }
  if (!validateAppName(data.name as string)) return { valid: false, error: 'name cannot be empty' }
  return { valid: true }
}

export function validateUpdateAppRequest(data: Record<string, unknown>): {
  valid: boolean
  error?: string
} {
  if (data.name !== undefined && !validateAppName(data.name as string)) {
    return { valid: false, error: 'name cannot be empty' }
  }
  return { valid: true }
}
