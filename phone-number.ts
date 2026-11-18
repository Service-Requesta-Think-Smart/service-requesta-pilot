/** Normalise common South African phone formats to the profile table's +27 format. */
export function normalizeSouthAfricanPhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return null;

  const compact = trimmed.replace(/[\s().-]/g, '');
  let nationalNumber: string;

  if (compact.startsWith('+27')) {
    nationalNumber = compact.slice(3);
  } else if (compact.startsWith('0027')) {
    nationalNumber = compact.slice(4);
  } else if (compact.startsWith('27')) {
    nationalNumber = compact.slice(2);
  } else if (compact.startsWith('0')) {
    nationalNumber = compact.slice(1);
  } else {
    return null;
  }

  return /^\d{9}$/.test(nationalNumber) ? `+27${nationalNumber}` : null;
}
