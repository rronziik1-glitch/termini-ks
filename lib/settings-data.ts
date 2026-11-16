// Server data for the Cilësimet screens (fable/termini-ui/settings.html).
import type { Business, User } from '@prisma/client';
import { daysOffList } from './api/owner';
import { rowsToHours } from './business';
import { bookingUrl, config, displayLink, livePageUrl } from './config';
import { db } from './db';
import { displayPhone, nationalPart } from './phone';
import { DAYS_SHORT, fmtDayMonth } from './time';

export type SettingsData = Awaited<ReturnType<typeof settingsData>>;

/** "Hën – Sht · nga ora 09:00" style summary of the weekly hours. */
function hoursSummary(days: { weekday: number; open: boolean; start: string }[]) {
  const open = days.filter((d) => d.open).sort((a, b) => a.weekday - b.weekday);
  if (!open.length) return null;
  const contiguous = open.every((d, i) => i === 0 || d.weekday === open[i - 1].weekday + 1);
  const label = open.length === 1 ? DAYS_SHORT[open[0].weekday - 1]
    : contiguous ? `${DAYS_SHORT[open[0].weekday - 1]} – ${DAYS_SHORT[open[open.length - 1].weekday - 1]}`
    : open.map((d) => DAYS_SHORT[d.weekday - 1]).join(', ');
  const earliest = open.map((d) => d.start).sort()[0];
  return { days: label, from: earliest };
}

export async function settingsData(user: User, b: Business, origin: string) {
  const [hoursRows, daysOff, page] = await Promise.all([
    db.workingHours.findMany({ where: { businessId: b.id } }),
    daysOffList(b),
    db.page.findFirst({ where: { businessId: b.id, status: { in: ['preview', 'payment_pending', 'paid', 'live'] } }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const hours = rowsToHours(hoursRows);
  const link = displayLink(b.slug, origin);
  return {
    business: {
      slug: b.slug, name: b.name, description: b.description, phone: nationalPart(b.phone), city: b.city, address: b.address, instagram: b.instagram,
      photoUrl: b.photoUrl, bookingsPaused: b.bookingsPaused, listedInFind: b.listedInFind, slotStepMin: b.slotStepMin,
      minNoticeMin: b.minNoticeMin, maxAdvanceDays: b.maxAdvanceDays, cancelCutoffMin: b.cancelCutoffMin, hasPin: b.lat !== null && b.lng !== null,
    },
    link: { prefix: link.prefix, url: bookingUrl(b.slug, origin) },
    user: { name: user.name, phone: displayPhone(user.phone), role: user.role },
    hoursSummary: hoursSummary(hours.days),
    nextDayOff: daysOff[0] ? fmtDayMonth(daysOff[0].from) : '',
    page: page ? { id: page.id, status: page.status, liveUrl: page.status === 'live' && page.subdomain ? livePageUrl(page.subdomain, origin) : '' } : null,
    supportWa: config.supportWhatsapp(),
  };
}
