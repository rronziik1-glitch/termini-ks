'use client';
// Owner calendar (fable/termini-ui/calendar.html): day timeline + week list, booking sheet, new booking, move, block.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, Field, Icon, PhoneInput, Sheet, TimeSelect, api, copyText, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, addDays, cap, dayNum, diffDays, fmtDateLong, fmtDayMonth, fmtDuration, fmtPrice, minToHm, mondayOf, weekdayOf } from '@/lib/time';

const t = sq.calendar;
const HOUR = 80;

type Booking = {
  id: string; date: string; startMin: number; endMin: number; time: string; endTime: string; status: string; rawStatus: string;
  serviceId: string; serviceName: string; durationMin: number; priceCents: number | null; note: string; source: string; reminderSent: boolean;
  customer: { id: string; name: string; phone: string; phoneDisplay: string; visits: number; noShows: number; isNew: boolean };
  wa: { reminder: string; confirm: string; cancel: string; noshow: string };
};
type DayInfo = { date: string; open: { start: number; end: number }[]; closed: boolean; dayOff: boolean; dayOffReason: string };
type Block = { id: string; date: string; startMin: number; endMin: number; reason: string };
type Data = { today: string; nowMin: number; days: DayInfo[]; blocks: Block[]; totalBookings: number; bookings: Booking[]; pending: { id: string; date: string }[] };
type Service = { id: string; name: string; durationMin: number; priceCents: number | null; priceFrom: boolean; active: boolean };

const cancelled = (b: Booking) => b.status.startsWith('cancelled') || b.status === 'expired';
const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1].charAt(0)}.` : n; };
const css = (v: Record<string, string | number>) => v as React.CSSProperties;

/** Side-by-side columns for overlapping bookings (the owner may overbook). */
function layout(list: Booking[]) {
  const out = new Map<string, { col: number; cols: number }>();
  let cluster: Booking[] = [], ends: number[] = [], clusterEnd = -1;
  const flush = () => { cluster.forEach((b) => { out.get(b.id)!.cols = ends.length; }); cluster = []; ends = []; };
  for (const b of [...list].sort((x, y) => x.startMin - y.startMin || y.endMin - x.endMin)) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let col = ends.findIndex((e) => e <= b.startMin);
    if (col < 0) { col = ends.length; ends.push(b.endMin); } else ends[col] = b.endMin;
    out.set(b.id, { col, cols: 1 });
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();
  return out;
}

export default function Calendar({ biz, link, today: today0 }: {
  biz: { name: string; slug: string; hasPhoto: boolean; slotStepMin: number; maxAdvanceDays: number };
  link: { url: string; shown: string }; today: string;
}) {
  const [date, setDate] = useState(today0);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [data, setData] = useState<Data | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState<Booking | null>(null);           // booking sheet
  const [sheet, setSheet] = useState<'' | 'booking' | 'new' | 'move' | 'block' | 'blocked'>('');
  const [form, setForm] = useState({ serviceId: '', date: today0, time: '10:00', name: '', phone: '' });
  const [formErr, setFormErr] = useState<{ name?: string; phone?: string; overlap?: string }>({});
  const [move, setMove] = useState({ date: today0, time: '10:00' });
  const [block, setBlock] = useState({ id: '', date: today0, start: '13:00', end: '13:30', reason: '' });
  const [busy, setBusy] = useState(false);
  const scrolled = useRef(false);
  const monday = mondayOf(date);
  const today = data?.today || today0;

  const load = useCallback(async (silent = false) => {
    try { setData(await api<Data>(`/bookings?from=${monday}&to=${addDays(monday, 6)}`)); }
    catch (e) { if (!silent) toastError(e); }
  }, [monday]);

  useEffect(() => { load(); const timer = setInterval(() => load(true), 60000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { api<{ services: Service[] }>('/services').then((r) => setServices(r.services)).catch(() => undefined); }, []);

  const day = data?.days.find((d) => d.date === date);
  const dayBookings = useMemo(() => (data?.bookings || []).filter((b) => b.date === date && !cancelled(b)), [data, date]);
  const dayBlocks = useMemo(() => (data?.blocks || []).filter((b) => b.date === date), [data, date]);
  const cols = useMemo(() => layout(dayBookings), [dayBookings]);

  /* timeline range: opening hours, widened by anything booked outside them */
  const range = useMemo(() => {
    const starts = [...(day?.open.map((o) => o.start) || []), ...dayBookings.map((b) => b.startMin), ...dayBlocks.map((b) => b.startMin)];
    const ends = [...(day?.open.map((o) => o.end) || []), ...dayBookings.map((b) => b.endMin), ...dayBlocks.map((b) => b.endMin)];
    if (!starts.length) return null;
    return { start: Math.floor(Math.min(...starts) / 60) * 60, end: Math.ceil(Math.max(...ends) / 60) * 60 };
  }, [day, dayBookings, dayBlocks]);
  const pauses = useMemo(() => {
    const o = day?.open || [];
    return o.slice(1).map((x, i) => ({ start: o[i].end, end: x.start })).filter((p) => p.end > p.start);
  }, [day]);

  /* open on "now" like a paper diary opened at today's page */
  useEffect(() => {
    if (scrolled.current || !data || view !== 'day') return;
    const now = document.querySelector('.now');
    if (now) { scrolled.current = true; window.scrollTo(0, now.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45); }
  }, [data, view]);

  const active = dayBookings;
  const revenue = active.filter((b) => b.status !== 'no_show').reduce((s, b) => s + (b.priceCents || 0), 0);
  const came = active.filter((b) => b.status === 'completed').length;
  const nextUp = date === today ? active.find((b) => b.status === 'confirmed' && b.startMin >= (data?.nowMin ?? 0)) : undefined;
  const hasAny = (d: string) => (data?.bookings || []).some((b) => b.date === d && !cancelled(b));

  const dateOptions = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i <= Math.max(60, biz.maxAdvanceDays); i++) list.push(addDays(today, i));
    for (const d of [date, form.date, move.date]) if (d < today && !list.includes(d)) list.unshift(d);
    return list;
  }, [today, date, form.date, move.date, biz.maxAdvanceDays]);
  const dateLabel = (d: string) => { const n = diffDays(today, d); return n === 0 ? `${sq.common.today}, ${fmtDayMonth(d)}` : n === 1 ? `${sq.common.tomorrow}, ${fmtDayMonth(d)}` : cap(fmtDateLong(d)); };

  /* ---- actions ---- */
  function openNew(time?: string) {
    const nowRounded = minToHm(Math.min(1425, Math.ceil(((data?.nowMin ?? 600) + 1) / 15) * 15));
    setForm({ serviceId: services.find((s) => s.active)?.id || services[0]?.id || '', date, time: time || (date === today ? nowRounded : minToHm(day?.open[0]?.start ?? 600)), name: '', phone: '' });
    setFormErr({}); setSheet('new');
  }

  async function saveNew(force = false) {
    if (form.name.trim().length < 2) { setFormErr({ name: sq.errors.name_required }); return; }
    setBusy(true);
    try {
      const r = await api<{ booking: Booking }>('/bookings', { body: { service_id: form.serviceId, date: form.date, time: form.time, name: form.name, phone: form.phone, force } });
      setSheet(''); setDate(form.date); await load();
      const wa = r.booking.wa.confirm;
      toast(t.bookingSaved, wa ? { action: t.sendWa, onAction: () => { window.open(wa, '_blank', 'noopener'); api(`/bookings/${r.booking.id}/whatsapp?type=confirm`).catch(() => undefined); } } : {});
    } catch (e) {
      const c = e instanceof ApiError ? e.code : '';
      if (c === 'overlap') setFormErr({ overlap: (e as ApiError).message });
      else if (c === 'invalid_phone') setFormErr({ phone: (e as ApiError).message });
      else if (c === 'name_required') setFormErr({ name: (e as ApiError).message });
      else toastError(e);
    }
    setBusy(false);
  }

  async function setStatus(b: Booking, status: string, message: string) {
    setSheet('');
    try {
      await api(`/bookings/${b.id}`, { method: 'PATCH', body: { status } });
      await load();
      const undo = () => api(`/bookings/${b.id}`, { method: 'PATCH', body: { status: b.rawStatus } }).then(() => { load(); toast(t.restored); }).catch(toastError);
      if (status === 'cancelled_business' && b.wa.cancel) {
        toast(message, { action: t.tellCustomer, onAction: () => { window.open(b.wa.cancel, '_blank', 'noopener'); api(`/bookings/${b.id}/whatsapp?type=cancel`).catch(() => undefined); } });
      } else toast(message, { action: sq.common.undo, onAction: undo });
    } catch (e) { toastError(e); }
  }

  /** v5: owner accepts a "to confirm" booking, then can tell the customer on WhatsApp. */
  async function confirmPending(b: Booking) {
    setSheet('');
    try {
      await api(`/bookings/${b.id}`, { method: 'PATCH', body: { status: 'confirmed' } });
      await load();
      if (b.wa.confirm) toast(t.confirmedToast(shortName(b.customer.name)), { action: t.tellCustomer, onAction: () => { window.open(b.wa.confirm, '_blank', 'noopener'); api(`/bookings/${b.id}/whatsapp?type=confirm`).catch(() => undefined); } });
      else toast(t.confirmedToast(shortName(b.customer.name)));
    } catch (e) { toastError(e); }
  }

  async function saveMove() {
    if (!open) return;
    const b = open;
    setBusy(true);
    try {
      await api(`/bookings/${b.id}`, { method: 'PATCH', body: { date: move.date, time: move.time } });
      setSheet(''); setDate(move.date); await load();
      toast(t.moved, { action: sq.common.undo, onAction: () => api(`/bookings/${b.id}`, { method: 'PATCH', body: { date: b.date, time: b.time } }).then(() => { setDate(b.date); load(); toast(t.restored); }).catch(toastError) });
    } catch (e) { toastError(e); }
    setBusy(false);
  }

  async function saveBlock() {
    if (block.end <= block.start) { toast(sq.errors.hours_order, { error: true }); return; }
    setBusy(true);
    try {
      await api('/time-off', { body: { kind: 'block', date: block.date, start: block.start, end: block.end, reason: block.reason } });
      setSheet(''); setDate(block.date); await load(); toast(t.blocked);
    } catch (e) { toastError(e); }
    setBusy(false);
  }

  async function removeBlock() {
    setSheet('');
    try { await api(`/time-off/${block.id}`, { method: 'DELETE' }); await load(); toast(t.unblocked); } catch (e) { toastError(e); }
  }

  function tapTimeline(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !range) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const min = Math.min(range.end - 15, range.start + Math.floor((y / HOUR) * 60 / 15) * 15);
    openNew(minToHm(Math.max(0, min)));
  }

  const badges = (b: Booking) => (
    <>
      {b.status === 'no_show' && <span className="badge badge--danger">{t.noShowBadge}</span>}
      {b.status === 'pending' && <span className="badge badge--new">{t.pendingBadge}</span>}
      {b.status === 'confirmed' && date === today && b.startMin <= (data?.nowMin ?? -1) && (data?.nowMin ?? 0) < b.endMin && <span className="badge badge--info">{t.nowBadge}</span>}
      {b.status === 'confirmed' && b.customer.isNew && b.customer.phone && <span className="badge badge--new">{t.newBadge}</span>}
      {b.status === 'confirmed' && b.customer.noShows > 0 && <span className="badge badge--danger">{t.noShows(b.customer.noShows)}</span>}
    </>
  );
  const eventClass = (b: Booking) => `event${b.durationMin <= 30 ? ' event--row' : ''}${b.status === 'completed' ? ' event--done' : b.status === 'no_show' ? ' event--noshow' : b.status === 'pending' ? ' event--pending' : ''}`;
  const showBooking = (b: Booking) => { setOpen(b); setMove({ date: b.date, time: b.time }); setSheet('booking'); };

  const b = open;
  return (
    <>
      <div className="app app--tabs app--calendar">
        <header className="topbar">
          <div className="grow">
            <p className="t-caption t-3">{biz.name}</p>
            <h1 className="t-h2">{cap(fmtDateLong(date))}</h1>
          </div>
          {date !== today && <button className="btn btn--secondary btn--sm btn--auto" onClick={() => setDate(today)}>{sq.common.today}</button>}
          <button className="iconbtn" aria-label={t.prevDay} onClick={() => setDate(addDays(date, view === 'week' ? -7 : -1))}><Icon name="chevron-left" /></button>
          <button className="iconbtn" aria-label={t.nextDay} onClick={() => setDate(addDays(date, view === 'week' ? 7 : 1))}><Icon name="chevron-right" /></button>
        </header>

        <div className="app__pad stack stack--3">
          <div className="days days--week">
            {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => (
              <button key={d} className={`day${d === date ? ' is-selected' : ''}`} aria-pressed={d === date} aria-label={fmtDateLong(d)} onClick={() => { setDate(d); setView('day'); }}>
                <span className="day__dow">{d === today ? sq.common.today : DAYS_SHORT[weekdayOf(d) - 1]}</span>
                <span className="day__num">{dayNum(d)}</span>
                <span className={`day__dot${hasAny(d) ? '' : ' day__dot--none'}`} />
              </button>
            ))}
          </div>
          <div className="segmented" role="group">
            <button className={view === 'day' ? 'is-selected' : ''} aria-pressed={view === 'day'} onClick={() => setView('day')}>{t.dayView}</button>
            <button className={view === 'week' ? 'is-selected' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>{t.weekView}</button>
          </div>
          {!!data?.pending?.length && (
            <button className="pending-banner" onClick={() => { const p = data.pending[0]; setDate(p.date); setView('day'); }}>
              <span className="pending-banner__dot" aria-hidden="true" />
              <span className="grow"><strong>{t.pendingBanner(data.pending.length)}</strong><span className="t-small t-2">{t.pendingHint}</span></span>
              <Icon name="chevron-right" />
            </button>
          )}
        </div>

        {!data ? (
          <main className="app__pad stack" style={{ paddingTop: 20 }}><div className="skeleton" style={{ height: 96 }} /><div className="skeleton" style={{ height: 320 }} /></main>
        ) : data.totalBookings === 0 ? (
          <main className="app__pad stack" style={{ paddingTop: 20 }}>
            <section className="card empty">
              <p className="empty__title">{t.emptyNew}</p>
              <p className="empty__text">{t.emptyNewText}</p>
              <button className="btn btn--primary" onClick={() => copyText(link.url)}>{t.shareLink}</button>
              <button className="btn btn--ghost btn--sm" onClick={() => openNew()}>{t.addOwn}</button>
            </section>
            <section className="list--card" aria-label={t.checklist}>
              <Link className="row" href="/app/cilesimet"><span className="row__main"><span className="row__title">{t.check1}</span><span className="row__meta t-mono">{link.shown}</span></span><span className="row__end"><Icon name="chevron-right" /></span></Link>
              <button className="row" onClick={() => openNew()}><span className="row__main"><span className="row__title">{t.check2}</span><span className="row__meta">{t.check2Meta}</span></span><span className="row__end"><Icon name="chevron-right" /></span></button>
              {!biz.hasPhoto && <Link className="row" href="/app/cilesimet/profili"><span className="row__main"><span className="row__title">{t.check3}</span><span className="row__meta">{t.check3Meta}</span></span><span className="row__end"><Icon name="chevron-right" /></span></Link>}
            </section>
          </main>
        ) : view === 'week' ? (
          <main className="app__pad" style={{ paddingTop: 8 }}>
            {data.days.map((d) => {
              const list = data.bookings.filter((x) => x.date === d.date && !cancelled(x));
              return (
                <section key={d.date}>
                  <div className="agenda__day">
                    <button className="t-h3" onClick={() => { setDate(d.date); setView('day'); }}>{d.date === today ? `${sq.common.today}, ${fmtDayMonth(d.date)}` : cap(fmtDateLong(d.date))}</button>
                    <span className="t-small t-3 t-num">{d.dayOff ? t.dayOff : d.closed && !list.length ? sq.common.closed : t.summary(list.length, '')}</span>
                  </div>
                  {list.length > 0 && (
                    <div className="list--card">
                      {list.map((x) => (
                        <button key={x.id} className={`row${x.status === 'completed' ? ' row--done' : x.status === 'no_show' ? ' row--noshow' : ''}`} onClick={() => showBooking(x)}>
                          <span className="row__time">{x.time}</span>
                          <span className="row__main"><span className="row__title">{x.customer.name}</span><span className="row__meta">{x.serviceName}</span></span>
                          {x.status === 'pending' ? <span className="badge badge--new">{t.pendingBadge}</span> : x.status === 'no_show' ? <span className="badge badge--danger">{t.noShowBadge}</span> : x.status === 'completed' ? <span className="badge badge--ok">{t.statusDone}</span> : <span className="row__price">{fmtPrice(x.priceCents)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {!data.bookings.some((x) => !cancelled(x)) && <p className="t-small t-3 t-center" style={{ padding: 24 }}>{t.weekEmpty}</p>}
          </main>
        ) : (
          <main className="app__pad stack" style={{ paddingTop: 20 }}>
            <section className="card stack stack--3" aria-label={t.daySummary}>
              {active.length === 0 ? (
                <p className="t-h3">{day?.dayOff ? `${t.dayOff}${day.dayOffReason ? ' ' + day.dayOffReason : ''}` : day?.closed ? (date === today ? t.closedDay : t.closedOtherDay) : date === today ? t.freeDay : t.freeOtherDay}</p>
              ) : (
                <>
                  <div className="split">
                    <p className="t-h2 t-num">{t.summary(active.length, revenue ? fmtPrice(revenue) : '')}</p>
                    {came > 0 && <span className="badge badge--ok">{t.came(came)}</span>}
                  </div>
                  {nextUp && <p className="t-small t-2">{t.next} <b style={{ color: 'var(--text)', fontWeight: 600 }}>{shortName(nextUp.customer.name)}</b> {t.inAt} {nextUp.time} · {nextUp.serviceName}</p>}
                </>
              )}
            </section>

            {range && (
              <section className="timeline" aria-label={t.dayBookings}>
                {Array.from({ length: (range.end - range.start) / 60 }, (_, i) => <div className="timeline__hour" key={i}><span>{minToHm(range.start + i * 60)}</span></div>)}
                <div className="timeline__hour timeline__hour--end"><span>{minToHm(range.end)}</span></div>

                <div className="timeline__events" onClick={tapTimeline}>
                  {pauses.map((p) => (
                    <div key={p.start} className="event event--row event--block" style={css({ '--start': p.start - range.start, '--len': p.end - p.start })}>
                      <span className="event__time">{minToHm(p.start)}</span><span className="event__name">{sq.settings.pause}</span>
                    </div>
                  ))}
                  {dayBlocks.map((x) => (
                    <button key={x.id} className="event event--row event--block" style={css({ '--start': x.startMin - range.start, '--len': x.endMin - x.startMin })}
                      onClick={() => { setBlock({ id: x.id, date: x.date, start: minToHm(x.startMin), end: minToHm(x.endMin), reason: x.reason }); setSheet('blocked'); }}>
                      <span className="event__time">{minToHm(x.startMin)}</span><span className="event__name">{x.reason || t.blockName}</span>
                    </button>
                  ))}
                  {dayBookings.map((x) => {
                    const c = cols.get(x.id) || { col: 0, cols: 1 };
                    const row = x.durationMin <= 30;
                    return (
                      <button key={x.id} className={eventClass(x)} style={css({ '--start': x.startMin - range.start, '--len': x.endMin - x.startMin, '--col': c.col, '--cols': c.cols })} onClick={() => showBooking(x)}>
                        {row ? (
                          <><span className="event__time">{x.time}</span><span className="event__name">{shortName(x.customer.name)}</span>{badges(x)}{x.status !== 'no_show' && <span className="event__svc">{x.serviceName}</span>}</>
                        ) : (
                          <>
                            <span className="event__line"><span className="event__name">{shortName(x.customer.name)}</span>{badges(x)}</span>
                            <span className="event__svc"><span className="t-num">{x.durationMin > 60 ? `${x.time} – ${x.endTime}` : x.time}</span> · {x.serviceName}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
                {date === today && data.nowMin >= range.start && data.nowMin <= range.end && (
                  <div className="now" style={css({ '--start': data.nowMin - range.start })} role="img" aria-label={t.nowLabel(minToHm(data.nowMin))} />
                )}
              </section>
            )}
          </main>
        )}
      </div>

      <button className="fab" onClick={() => openNew()}><Icon name="plus" />{t.fab}</button>

      {/* BookingSheet */}
      <Sheet open={sheet === 'booking' && !!b} onClose={() => setSheet('')} title={b?.customer.name || ''}
        head={{
          before: <span className="avatar avatar--lg" aria-hidden="true">{b?.customer.name.charAt(0).toUpperCase()}</span>,
          sub: b && (
            <p className="cluster t-small t-2">
              {b.status === 'pending' && <span className="badge badge--new">{t.pendingBadge}</span>}
              {b.status === 'completed' && <span className="badge badge--ok">{t.statusDone}</span>}
              {b.status === 'no_show' && <span className="badge badge--danger">{t.noShowBadge}</span>}
              {b.customer.isNew && b.customer.phone ? <><span className="badge badge--new">{t.newBadge}</span><span>{t.firstVisit}</span></> : <span>{b.customer.phone ? t.visits(b.customer.visits) : t.walkIn}</span>}
              {b.customer.noShows > 0 && <span className="badge badge--danger">{t.noShows(b.customer.noShows)}</span>}
            </p>
          ),
          after: b?.customer.phone ? <a className="iconbtn iconbtn--fill" href={`tel:${b.customer.phone}`} aria-label={t.callName(b.customer.name)}><Icon name="phone" /></a> : undefined,
        }}
        actions={b && (b.status === 'pending' ? (
          <>
            <p className="t-small t-2">{t.pendingHint}</p>
            <div className="cluster" style={{ flexWrap: 'nowrap' }}>
              <button className="btn btn--primary" onClick={() => confirmPending(b)}><Icon name="check" size="sm" />{t.confirm1}</button>
              <button className="btn btn--danger" onClick={() => setStatus(b, 'cancelled_business', t.refusedToast)}>{t.refuse1}</button>
            </div>
          </>
        ) : (
          <>
            {b.status === 'confirmed' && b.wa.reminder && (
              <a className="btn btn--whatsapp" href={b.wa.reminder} target="_blank" rel="noopener noreferrer"
                onClick={() => { api(`/bookings/${b.id}/whatsapp?type=reminder`).then(() => load(true)).catch(() => undefined); }}>
                <Icon name="whatsapp" />{t.remind}
              </a>
            )}
            <div className="cluster" style={{ flexWrap: 'nowrap' }}>
              <button className="btn btn--secondary" disabled={b.rawStatus === 'completed'} onClick={() => setStatus(b, 'completed', t.markedCame(shortName(b.customer.name)))}><Icon name="check" size="sm" />{t.came1}</button>
              <button className="btn btn--danger" disabled={b.rawStatus === 'no_show'} onClick={() => setStatus(b, 'no_show', t.markedNoShow(shortName(b.customer.name)))}>{t.noShow1}</button>
            </div>
            <div className="cluster" style={{ flexWrap: 'nowrap' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setSheet('move')}><Icon name="move" size="sm" />{t.move}</button>
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }} onClick={() => setStatus(b, 'cancelled_business', t.cancelled)}>{t.cancel}</button>
            </div>
          </>
        ))}>
        {b && (
          <dl className="summary">
            <div className="summary__row"><dt>{t.service}</dt><dd>{b.serviceName} · {fmtDuration(b.durationMin)}</dd></div>
            <div className="summary__row"><dt>{t.time}</dt><dd className="t-num">{b.date === today ? 'sot' : fmtDateLong(b.date)}, {b.time} – {b.endTime}</dd></div>
            <div className="summary__row"><dt>{t.price}</dt><dd className="t-num">{b.priceCents === null ? sq.common.priceOnSite : fmtPrice(b.priceCents)}</dd></div>
            {b.customer.phone && <div className="summary__row"><dt>{t.phone}</dt><dd className="t-num">{b.customer.phoneDisplay}</dd></div>}
            {b.note && <div className="summary__row"><dt>{t.note}</dt><dd>{b.note}</dd></div>}
          </dl>
        )}
      </Sheet>

      {/* MoveSheet */}
      <Sheet open={sheet === 'move' && !!b} onClose={() => setSheet('')} title={t.moveTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={saveMove}>{t.moveSave}</button>}>
        <div className="cluster" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <div className="field grow">
            <label className="field__label" htmlFor="md">{t.day}</label>
            <select className="input" id="md" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })}>{dateOptions.map((d) => <option key={d} value={d}>{dateLabel(d)}</option>)}</select>
          </div>
          <div className="field" style={{ width: 120 }}>
            <label className="field__label" htmlFor="mt">{t.time}</label>
            <TimeSelect id="mt" wide step={15} to={1425} value={move.time} onChange={(v) => setMove({ ...move, time: v })} />
          </div>
        </div>
      </Sheet>

      {/* NewBookingSheet */}
      <Sheet open={sheet === 'new'} onClose={() => setSheet('')} title={t.newTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy || !form.serviceId} onClick={() => saveNew(!!formErr.overlap)}>{formErr.overlap ? t.saveAnyway : t.saveBooking}</button>}>
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); saveNew(!!formErr.overlap); }}>
          <div className="stack stack--3">
            <p className="field__label">{t.service}</p>
            {services.length === 0 ? <p className="note">{sq.services.emptyText} <Link className="link" href="/app/sherbimet">{sq.services.addService}</Link></p> : (
              <div className="chips">
                {services.map((s) => <button type="button" key={s.id} className={`chip${form.serviceId === s.id ? ' is-selected' : ''}`} aria-pressed={form.serviceId === s.id} onClick={() => { setForm({ ...form, serviceId: s.id }); setFormErr({}); }}>{s.name}{s.priceCents !== null ? ` · ${fmtPrice(s.priceCents)}` : ''}</button>)}
              </div>
            )}
          </div>
          <div className="cluster" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div className="field grow">
              <label className="field__label" htmlFor="nd">{t.day}</label>
              <select className="input" id="nd" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setFormErr({}); }}>{dateOptions.map((d) => <option key={d} value={d}>{dateLabel(d)}</option>)}</select>
            </div>
            <div className="field" style={{ width: 120 }}>
              <label className="field__label" htmlFor="nt">{t.time}</label>
              <TimeSelect id="nt" wide step={15} to={1425} value={form.time} onChange={(v) => { setForm({ ...form, time: v }); setFormErr({}); }} />
            </div>
          </div>
          <Field label={t.clientName} htmlFor="nn" error={formErr.name}>
            <input className="input" id="nn" autoComplete="off" placeholder={t.clientNamePh} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t.clientPhone} small={sq.common.ifAny} htmlFor="np" hint={t.clientPhoneHint} error={formErr.phone}>
            <PhoneInput id="np" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder={sq.booking.phonePh} invalid={!!formErr.phone} />
          </Field>
          {formErr.overlap && <p className="card card--flat t-small" role="alert">{formErr.overlap}</p>}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setBlock({ id: '', date: form.date, start: form.time, end: minToHm(Math.min(1440, Number(form.time.slice(0, 2)) * 60 + Number(form.time.slice(3)) + 30)), reason: '' }); setSheet('block'); }}>{t.blockTime}</button>
          <button type="submit" hidden />
        </form>
      </Sheet>

      {/* BlockSheet: new block */}
      <Sheet open={sheet === 'block'} onClose={() => setSheet('')} title={t.blockTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={saveBlock}>{t.blockSave}</button>}>
        <div className="stack">
          <p className="t-2">{dateLabel(block.date)}</p>
          <div className="cluster" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div className="field grow"><label className="field__label" htmlFor="bs">{t.time}</label><TimeSelect id="bs" wide step={15} to={1425} value={block.start} onChange={(v) => setBlock({ ...block, start: v })} /></div>
            <div className="field grow"><label className="field__label" htmlFor="be">{t.blockUntil}</label><TimeSelect id="be" wide step={15} value={block.end} onChange={(v) => setBlock({ ...block, end: v })} /></div>
          </div>
          <Field label={t.blockReason} small={sq.common.optional} htmlFor="br">
            <input className="input" id="br" autoComplete="off" placeholder={t.blockReasonPh} value={block.reason} maxLength={80} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
          </Field>
        </div>
      </Sheet>

      {/* BlockSheet: existing block */}
      <Sheet open={sheet === 'blocked'} onClose={() => setSheet('')} title={block.reason || t.blockTitle}
        actions={<>
          <button className="btn btn--danger" onClick={removeBlock}>{t.unblock}</button>
          <button className="btn btn--secondary" onClick={() => setSheet('')}>{sq.common.close}</button>
        </>}>
        <p className="t-2 t-num">{dateLabel(block.date)} · {block.start} – {block.end}</p>
      </Sheet>
    </>
  );
}
