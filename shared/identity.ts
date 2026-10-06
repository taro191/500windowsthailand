const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '')

/** Validates a Thai national ID with the Department of Provincial Administration checksum. */
export function isValidCitizenId(value: string): boolean {
  const digits = digitsOnly(value)
  if (digits.length !== 13 || /^(\d)\1{12}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(digits.charAt(i), 10) * (13 - i)
  return (11 - (sum % 11)) % 10 === parseInt(digits.charAt(12), 10)
}

/** Formats as `x-xxxx-xxxxx-xx-x` while typing. */
export function formatCitizenId(value: string): string {
  const digits = digitsOnly(value).slice(0, 13)
  if (!digits) return ''
  const parts: string[] = [digits.slice(0, 1)]
  if (digits.length > 1) parts.push(digits.slice(1, 5))
  if (digits.length > 5) parts.push(digits.slice(5, 10))
  if (digits.length > 10) parts.push(digits.slice(10, 12))
  if (digits.length > 12) parts.push(digits.slice(12, 13))
  return parts.join('-')
}

/** `1-2345-XXXXX-67-8` */
export function maskCitizenId(value?: string): string {
  if (!value) return ''
  const formatted = formatCitizenId(value)
  const parts = formatted.split('-')
  return parts.length === 5 ? `${parts[0]}-${parts[1]}-XXXXX-${parts[3]}-${parts[4]}` : formatted
}

/** Formats as `0xx-xxx-xxxx` while typing. */
export function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 10)
  if (!digits) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

/** `081-XXX-3344` */
export function maskPhone(value?: string): string {
  if (!value) return ''
  const digits = digitsOnly(value)
  return digits.length >= 9 ? `${digits.slice(0, 3)}-XXX-${digits.slice(-4)}` : value
}

/** Thai mobile numbers: 10 digits starting with 06, 08 or 09. */
export function isValidThaiMobile(value: string): boolean {
  return /^(0[689]\d{8})$/.test(digitsOnly(value))
}
