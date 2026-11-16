import { afterEach, describe, expect, it } from 'vitest';
import { adminUnlocked, hashPassword, unlockAdmin } from '../lib/adminAuth';

describe('admin second lock (password after SMS code)', () => {
  afterEach(() => { delete process.env.ADMIN_PASSWORD_HASH; });

  it('opens only with the right password, and only for the same login session', () => {
    process.env.ADMIN_PASSWORD_HASH = hashPassword('kali i bardhe ne rugove');
    expect(adminUnlocked('sess-A', undefined)).toBe(false);

    const wrong = unlockAdmin('sess-A', 'gabim', 'ip-1');
    expect(wrong.ok).toBe(false);

    const r = unlockAdmin('sess-A', 'kali i bardhe ne rugove', 'ip-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(adminUnlocked('sess-A', r.cookie)).toBe(true);
    expect(adminUnlocked('sess-B', r.cookie)).toBe(false);          // copied cookie is useless on another session
    expect(adminUnlocked('sess-A', r.cookie.replace(/.$/, 'x'))).toBe(false);
  });

  it('blocks guessing after 5 tries from one place', () => {
    process.env.ADMIN_PASSWORD_HASH = hashPassword('kali i bardhe ne rugove');
    for (let i = 0; i < 5; i++) unlockAdmin('s', 'guess' + i, 'ip-guess');
    const r = unlockAdmin('s', 'kali i bardhe ne rugove', 'ip-guess');
    expect(r).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('stores no plain password', () => {
    const h = hashPassword('kali i bardhe ne rugove');
    expect(h).not.toContain('kali');
    expect(h.startsWith('scrypt$')).toBe(true);
  });
});
