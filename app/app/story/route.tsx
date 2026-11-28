// v7: today's free times as a 1080x1920 Instagram Story image (PNG), in the Termini style, with the booking link and QR.
// The owner shares it with one tap from "Arka". Only for the logged-in owner of the business.
import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { freeStarts, isClosed, loadCtx } from '@/lib/availability';
import { bookingUrl, config, displayLink } from '@/lib/config';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { sq } from '@/lib/sq';
import { DAYS_NAME, fmtDayMonth, toLocal, weekdayOf } from '@/lib/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { business: b } = await getSession();
  if (!b) return new Response('Not found', { status: 404 });
  const now = new Date();
  const today = toLocal(now, b.timezone).date;
  const services = await db.service.findMany({ where: { businessId: b.id, active: true, deleted: false } });
  const shortest = services.sort((x, y) => x.durationMin - y.durationMin)[0];
  let times: string[] = [];
  if (shortest && !b.bookingsPaused) {
    const ctx = await loadCtx(b, today, 1);
    if (!isClosed(ctx, today)) times = freeStarts(ctx, shortest, null, today, now).map((s) => s.time);
  }
  // At most 9 times on the image; spread over the day when there are more.
  const shown = times.length <= 9 ? times : Array.from({ length: 9 }, (_, i) => times[Math.round((i * (times.length - 1)) / 8)]);
  const origin = config.appUrl();
  const link = displayLink(b.slug, origin);
  const qr = await QRCode.toDataURL(bookingUrl(b.slug, origin), { margin: 1, width: 360, color: { dark: '#0c0c0d', light: '#ffffff' } });
  const day = `${DAYS_NAME[weekdayOf(today) - 1]}, ${fmtDayMonth(today)}`;
  const lime = '#c8f03c';

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: 'flex', flexDirection: 'column', background: '#0c0c0d', color: '#fff', padding: '120px 96px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
          termini<span style={{ width: 14, height: 14, borderRadius: 7, background: lime, marginLeft: 6, marginTop: 14 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 120 }}>
          <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{b.name}</div>
          <div style={{ display: 'flex', fontSize: 44, color: 'rgba(255,255,255,0.65)', marginTop: 24 }}>{day}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: lime, marginTop: 96 }}>{shown.length ? sq.g.storyFree : sq.g.storyNone}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 40, gap: 28 }}>
          {shown.map((x) => (
            <div key={x} style={{ display: 'flex', width: 272, height: 128, borderRadius: 32, background: '#1c1c1f', border: '2px solid #2c2c30', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 700 }}>{x}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, background: '#1c1c1f', borderRadius: 40, padding: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={220} height={220} style={{ borderRadius: 20 }} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 40, color: 'rgba(255,255,255,0.65)' }}>{sq.g.storyBook}</div>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, marginTop: 8 }}>{`${link.prefix}${link.slug}`}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { 'cache-control': 'private, no-store' } },
  );
}
