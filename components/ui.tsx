'use client';
// Shared client components. Class names come from app/styles/termini.css (Fable's design system).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { sq } from '@/lib/sq';

/* ---- API helper ---------------------------------------------------------------------- */
export class ApiError extends Error {
  constructor(public code: string, public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

type ApiOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; form?: FormData };

/** Calls /api/*. Throws ApiError with an Albanian message that is ready to show. */
export async function api<T = Record<string, unknown>>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('offline', 0, sq.common.offline);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data && data.error) || {};
    throw new ApiError(e.code || 'server_error', res.status, e.message || sq.common.failed, e);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : sq.common.failed);

/* ---- icons (Lucide, 24px, stroke 1.75) -------------------------------------------------- */
const P: Record<string, string> = {
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  'calendar-plus': '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88M14.8 14.8 20 20"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  navigation: '<path d="m3 11 19-9-9 19-2-8-8-2Z"/>',
  move: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15v4M17 17h4M5 3v3M3.5 4.5h3"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
};
const WA = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24ZM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.13.17 1.76 2.67 4.25 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.48-.29-.25-.12-1.47-.72-1.69-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.4 7.4 0 0 1-1.38-1.72c-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43l-.48-.01Z';

export function Icon({ name, size, className = '', style }: { name: string; size?: 'sm' | 'xs'; className?: string; style?: React.CSSProperties }) {
  const cls = `icon${size ? ' icon--' + size : ''}${className ? ' ' + className : ''}`;
  if (name === 'whatsapp') {
    return <i className={cls} style={style} aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d={WA} /></svg></i>;
  }
  return (
    <i className={cls} style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: P[name] || '' }} />
    </i>
  );
}

export const Wordmark = ({ small }: { small?: boolean }) => <span className={`wordmark${small ? ' wordmark--sm' : ''}`}>{sq.brand.termini}</span>;

export function SuccessMark() {
  return (
    <div className="success" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
    </div>
  );
}

/* ---- toast ----------------------------------------------------------------------------- */
type ToastState = { id: number; text: string; action?: string; onAction?: () => void; error?: boolean } | null;
let toastListener: ((t: ToastState) => void) | null = null;
let toastId = 0;

export function toast(text: string, opts: { action?: string; onAction?: () => void; error?: boolean } = {}) {
  toastListener?.({ id: ++toastId, text, ...opts });
}
export const toastError = (e: unknown) => toast(errorText(e), { error: true });

export function Toaster() {
  const [t, setT] = useState<ToastState>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    toastListener = (next) => { setT(next); setOpen(true); };
    return () => { toastListener = null; };
  }, []);
  useEffect(() => {
    if (!t || !open) return;
    const timer = setTimeout(() => setOpen(false), t.action ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [t, open]);
  return (
    <div className={`toast${open ? ' is-open' : ''}`} role={t?.error ? 'alert' : 'status'}>
      <span>{t?.text}</span>
      {t?.action && (
        <button className="toast__action" onClick={() => { setOpen(false); t.onAction?.(); }}>{t.action}</button>
      )}
    </div>
  );
}

/* ---- bottom sheet ------------------------------------------------------------------------ */
export function Sheet({ open, onClose, title, head, children, actions, closeButton = false }: {
  open: boolean; onClose: () => void; title: ReactNode; head?: { before?: ReactNode; after?: ReactNode; sub?: ReactNode };
  children?: ReactNode; actions?: ReactNode; closeButton?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const last = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    last.current = document.activeElement;
    const el = ref.current;
    const title = el?.querySelector<HTMLElement>('.sheet__title');
    title?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {                                             // keep focus inside the sheet
        const items = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea');
        if (!items.length) return;
        const first = items[0], end = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === title)) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (last.current instanceof HTMLElement) last.current.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  return (
    <>
      <div className={`scrim${open ? ' is-open' : ''}`} onClick={onClose} />
      <section ref={ref} className={`sheet${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-hidden={!open}>
        <span className="sheet__grab" />
        <div className="sheet__head">
          {head?.before}
          <div className="grow">
            <h2 className="sheet__title" id={id} tabIndex={-1} style={{ outline: 0 }}>{title}</h2>
            {head?.sub}
          </div>
          {head?.after}
          {closeButton && <button type="button" className="iconbtn iconbtn--fill" onClick={onClose} aria-label={sq.common.close}><Icon name="x" /></button>}
        </div>
        {children !== undefined && <div className="sheet__body">{children}</div>}
        {actions && <div className="sheet__actions">{actions}</div>}
      </section>
    </>
  );
}

/* ---- small controls ------------------------------------------------------------------------ */
export function Switch({ checked, onChange, label, labelledBy, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; labelledBy?: string; disabled?: boolean }) {
  return <button type="button" className="switch" role="switch" aria-checked={checked} aria-label={label} aria-labelledby={labelledBy} disabled={disabled} onClick={() => onChange(!checked)} />;
}

const pad = (n: number) => (n < 10 ? '0' + n : String(n));
/** 24-hour time as a <select> (never input type=time, which can show AM/PM). */
export function TimeSelect({ value, onChange, step = 30, label, id, wide, from = 5 * 60, to = 24 * 60 }: {
  value: string; onChange: (v: string) => void; step?: number; label?: string; id?: string; wide?: boolean; from?: number; to?: number;
}) {
  const options: string[] = [];
  for (let m = from; m <= to; m += step) options.push(m === 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (value && !options.includes(value)) { options.push(value); options.sort(); }
  return (
    <select id={id} className={`input input--time ${wide ? 'input--wide' : 'input--sm'}`} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {options.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

export function Field({ label, small, hint, error, children, htmlFor }: { label?: ReactNode; small?: string; hint?: ReactNode; error?: string | null | false; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field${error ? ' is-invalid' : ''}`}>
      {label && <label className="field__label" htmlFor={htmlFor}>{label}{small && <> <small>{small}</small></>}</label>}
      {children}
      {hint && <p className="field__hint">{hint}</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}

/** Phone input with the fixed +383 prefix. Numbers typed with "+" or "00" keep their own country code. */
export function PhoneInput({ id, value, onChange, placeholder, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; describedBy?: string }) {
  const intl = /^\s*(\+|00)/.test(value);
  return (
    <div className="inputgroup">
      {!intl && <span className="inputgroup__ad">+383</span>}
      <input className="input t-num" id={id} name="phone" type="tel" inputMode="tel" autoComplete={intl ? 'tel' : 'tel-national'} placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
    </div>
  );
}

/** Six boxes for the login code, auto-advance, paste support. */
export function CodeInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (next: string, focus: number) => {
    const v = next.replace(/\D/g, '').slice(0, 6);
    onChange(v);
    refs.current[Math.min(focus, 5)]?.focus();
    if (v.length === 6) onComplete?.(v);
  };
  return (
    <div className="code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} id={i === 0 ? 'code-1' : undefined} inputMode="numeric" maxLength={6} autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={sq.login.digit(i + 1)} value={value[i] || ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '');
            if (d.length > 1) return set(d, d.length);                              // paste or SMS autofill
            set(value.slice(0, i) + d + value.slice(i + 1), d ? i + 1 : i);
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i] && i > 0) { e.preventDefault(); set(value.slice(0, i - 1), i - 1); } }}
          onFocus={(e) => e.target.select()} />
      ))}
    </div>
  );
}

export async function copyText(text: string, done: string = sq.common.linkCopied) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    ta.remove();
  }
  toast(done);
}

/* ---- owner tab bar ---------------------------------------------------------------------------- */
const TABS = [
  { href: '/app', icon: 'calendar', label: sq.tabs.calendar },
  { href: '/app/klientet', icon: 'users', label: sq.tabs.customers },
  { href: '/app/sherbimet', icon: 'scissors', label: sq.tabs.services },
  { href: '/app/arka', icon: 'wallet', label: sq.g.tab },
  { href: '/app/cilesimet', icon: 'settings', label: sq.tabs.settings },
];
export function Tabs() {
  const path = usePathname() || '/app';
  if (/^\/app\/cilesimet\/.+/.test(path)) return null;                              // settings sub-screens have a save bar instead
  return (
    <nav className="tabs" aria-label={sq.tabs.main}>
      <div className="tabs__in">
        {TABS.map((t) => {
          const active = t.href === '/app' ? path === '/app' : path.startsWith(t.href);
          return <Link key={t.href} href={t.href} className={`tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon name={t.icon} />{t.label}</Link>;
        })}
      </div>
    </nav>
  );
}

/** Adds .is-in to .reveal elements when 15% visible (marketing pages). */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    document.documentElement.classList.add('has-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
