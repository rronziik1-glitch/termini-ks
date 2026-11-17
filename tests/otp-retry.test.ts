// Retry logic for login codes (lib/otp.ts sendLoginCode): temporary failures are tried again, permanent ones are not.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTemporaryFailure, OtpSendError, sendLoginCode } from '../lib/otp';

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });
const useSms = () => Object.assign(process.env, { OTP_PROVIDER: 'sms', SMS_STYLE: 'generic', SMS_API_URL: 'https://sms.example/send' });

describe('login code retry', () => {
  it('knows which failures are worth retrying', () => {
    for (const s of [0, 429, 500, 502, 503]) expect(isTemporaryFailure(s), String(s)).toBe(true);
    for (const s of [200, 400, 401, 402, 403, 404]) expect(isTemporaryFailure(s), String(s)).toBe(false);
  });

  it('a provider hiccup (503) is retried and the code still goes out', async () => {
    useSms();
    const f = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(sendLoginCode('+38349123456', '123456')).resolves.toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('no network at all: 3 tries, then the user gets the "not sent" message', async () => {
    useSms();
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(sendLoginCode('+38349123456', '123456')).rejects.toBeInstanceOf(OtpSendError);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('a permanent refusal (account not approved, wrong key) is not retried', async () => {
    useSms();
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"code":20003}', { status: 401 }));
    await expect(sendLoginCode('+38349123456', '123456')).rejects.toBeInstanceOf(OtpSendError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
