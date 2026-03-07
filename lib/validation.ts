/** Strip all non-digit characters and return the digits only. */
export function stripPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** A valid phone number is exactly 10 digits. */
export function isValidPhone(phone: string): boolean {
  return stripPhone(phone).length === 10;
}

/** Format 10 digits as (XXX) XXX-XXXX. Returns raw input if not 10 digits. */
export function formatPhone(phone: string): string {
  const d = stripPhone(phone);
  if (d.length !== 10) return phone;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Basic email format: something@something.something */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
