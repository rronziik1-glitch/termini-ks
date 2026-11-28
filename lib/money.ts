// v7 money book ("Arka"): income from the calendar (each visit already has a price; the owner marks cash / card),
// expenses typed in with an optional receipt photo, and a monthly summary + Excel (CSV) for the accountant.
// It helps the accountant; it is NOT a fiscal receipt and does not replace the fiscal device.
import type { Business } from '@prisma/client';
import { AppError, db } from './db';
import { sq } from './sq';
import { addDays, fmtPrice, localMinToUtc, toLocal } from './time';

export const EXPENSE_CATS = ['qira', 'produkte', 'rryma', 'paga', 'tjeter'] as const;
export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const monthStart = (m: string) => `${m}-01`;
export function nextMonth(m: string) { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
const MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
export const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export type MoneyVisit = { id: string; date: string; time: string; customer: string; service: string; priceCents: number; paid: string; source: string; fromWinback: boolean };
export type MoneyExpense = { id: string; date: string; amountCents: number; category: string; note: string; hasReceipt: boolean };

/** Everything for one month: visits (past, kept), expenses, totals, and what Termini brought. */
export async function monthMoney(b: Business, month: string, now = new Date()) {
  if (!isMonth(month)) throw new AppError('bad_request', 400, sq.errors.bad_request);
  const tz = b.timezone;
  const start = localMinToUtc(monthStart(month), 0, tz);
  const end = localMinToUtc(monthStart(nextMonth(month)), 0, tz);
  const [bookings, expenses, reminders] = await Promise.all([
    db.booking.findMany({ where: { businessId: b.id, startsAt: { gte: start, lt: end } }, include: { customer: true }, orderBy: { startsAt: 'asc' } }),
    db.expense.findMany({ where: { businessId: b.id, date: { gte: monthStart(month), lt: monthStart(nextMonth(month)) } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    db.messageLog.count({ where: { businessId: b.id, kind: 'reminder24', status: 'sent', createdAt: { gte: start, lt: end } } }),
  ]);
  const kept = bookings.filter((x) => x.startsAt < now && (x.status === 'confirmed' || x.status === 'completed'));
  const visits: MoneyVisit[] = kept.map((x) => {
    const l = toLocal(x.startsAt, tz);
    return { id: x.id, date: l.date, time: l.time, customer: x.customer.name, service: x.serviceName, priceCents: x.priceCents || 0, paid: x.paidMethod, source: x.source, fromWinback: x.fromWinback };
  });
  const sum = (xs: { priceCents?: number; amountCents?: number }[]) => xs.reduce((s, x) => s + (x.priceCents ?? x.amountCents ?? 0), 0);
  const cash = sum(visits.filter((v) => v.paid === 'cash'));
  const card = sum(visits.filter((v) => v.paid === 'card'));
  const unmarked = sum(visits.filter((v) => !v.paid));
  const income = cash + card + unmarked;
  const spent = sum(expenses);
  const online = visits.filter((v) => v.source !== 'manual');
  const winback = visits.filter((v) => v.fromWinback);
  const cancelledInTime = bookings.filter((x) => x.status === 'cancelled_customer' && x.cancelledAt && x.startsAt.getTime() - x.cancelledAt.getTime() > 3600e3);
  return {
    month, label: monthLabel(month), visits,
    expenses: expenses.map((e) => ({ id: e.id, date: e.date, amountCents: e.amountCents, category: e.category, note: e.note, hasReceipt: !!e.receiptKey })) as MoneyExpense[],
    totals: { income, cash, card, unmarked, expenses: spent, profit: income - spent },
    termini: {
      onlineCount: online.length, onlineCents: sum(online),
      winbackCount: winback.length, winbackCents: sum(winback),
      reminders, cancelledInTimeCount: cancelledInTime.length, cancelledInTimeCents: cancelledInTime.reduce((s, x) => s + (x.priceCents || 0), 0),
    },
  };
}
export type MonthMoney = Awaited<ReturnType<typeof monthMoney>>;

/** Excel-friendly CSV (semicolon, UTF-8 with BOM so ë / ç show correctly). */
export function moneyCsv(b: Pick<Business, 'name'>, m: MonthMoney): string {
  const e = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const eur = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const paid = (p: string) => (p === 'cash' ? sq.g.cash : p === 'card' ? sq.g.card : sq.g.unmarked);
  const lines = [
    [sq.g.reportTitle(b.name, m.label)],
    [],
    ['Data', 'Ora', 'Klienti', 'Shërbimi', 'Shuma (€)', 'Pagesa'],
    ...m.visits.map((v) => [v.date, v.time, v.customer, v.service, eur(v.priceCents), paid(v.paid)]),
    [],
    ['Data', 'Shpenzimi', 'Shënim', 'Shuma (€)'],
    ...m.expenses.map((x) => [x.date, sq.g.expenseCats[x.category] || x.category, x.note, eur(x.amountCents)]),
    [],
    [sq.g.income, eur(m.totals.income)], [sq.g.cash, eur(m.totals.cash)], [sq.g.card, eur(m.totals.card)], [sq.g.unmarked, eur(m.totals.unmarked)],
    [sq.g.expenses, eur(m.totals.expenses)], [sq.g.profit, eur(m.totals.profit)],
    [], [sq.g.notFiscal],
  ];
  return '﻿' + lines.map((r) => r.map((c) => e(String(c))).join(';')).join('\r\n');
}

export const eur = (c: number) => fmtPrice(c) || '0 €';

/** Current month in the business's time zone ("2026-11"). */
export const thisMonth = (b: Pick<Business, 'timezone'>, now = new Date()) => toLocal(now, b.timezone).date.slice(0, 7);
export const lastDayOf = (m: string) => addDays(monthStart(nextMonth(m)), -1);
