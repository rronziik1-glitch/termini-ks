// Phone normalisation (01-product-design.md §5). Output is E.164 or null.

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s().\-/]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    const d = s.slice(1);
    if (!/^\d{8,15}$/.test(d) || d.startsWith('0')) return null;
    // "+383 044 123 456" typed after the prefix
    if (d.startsWith('3830') && d.length === 12) return '+383' + d.slice(4);
    return '+' + d;
  }
  if (!/^\d+$/.test(s)) return null;
  if (/^0[2-4]\d{7}$/.test(s)) return '+383' + s.slice(1);      // 044 123 456, 038 123 456
  if (/^[2-4]\d{7}$/.test(s)) return '+383' + s;                // 44 123 456 (typed next to the +383 prefix)
  if (/^383[2-4]\d{7}$/.test(s)) return '+' + s;
  return null;                                                  // Albania 06x… only with +355
}

/** "+38349123456" → "049 123 456"; other countries stay international. */
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+383(\d{2})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `0${m[1]} ${m[2]} ${m[3]}`;
  return e164.replace(/^(\+\d{2,3})(\d+)$/, '$1 $2');
}

/** "+38349123456" → "49 123 456" (shown next to the fixed +383 prefix); others keep the plus. */
export function nationalPart(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+383(\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}

export const waDigits = (e164: string) => e164.replace(/\D/g, '');

/** "049 ••• •••": used in the unpaid preview. */
export function maskPhone(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length < 6) return '••• ••• •••';
  const head = display.trim().startsWith('+') ? '+' + d.slice(0, 3) : d.slice(0, 3);
  return `${head} ••• •••`;
}
