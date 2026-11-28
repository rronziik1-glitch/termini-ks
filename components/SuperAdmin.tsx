'use client';
// v6 Super Admin panel (Roni): overview numbers, every registered business with filters, a read-only view of one
// business (its calendar, clients, history and setup), suspend / unsuspend, and the audit log. Faqja Gati pages are a
// tab only while Faqja Gati is switched on. Same design system as the owner app (tokens, cards, rows, badges, sheets).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FgPagesTab } from '@/components/Admin';
import AdminListings from '@/components/AdminListings';
import { Field, Icon, Sheet, Wordmark, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, fmtDayMonth, fmtDuration, fmtPrice, toLocal } from '@/lib/time';

const t = sq.sa;

/* ---- data shapes (from lib/api/admin.ts) ------------------------------------------------- */
type Overview = {
  businesses: { total: number; live: number; suspended: number; paused: number; approval: number; new7: number };
  owners: number; customers: number;
  bookings: { today: number; week: number; month: number; upcoming7: number; pending: number };
  signups: { date: string; n: number }[]; bookingsPerDay: { date: string; n: number }[];
  top: { id?: string; name?: string; city?: string; bookings: number }[];
  newest: { id: string; name: string; city: string; category: string; createdAt: string }[];
};
type BizRow = {
  id: string; slug: string; name: string; category: string; city: string; url: string; owner: string; ownerPhone: string; ownerLastLogin: string | null;
  createdAt: string; onboarded: boolean; paused: boolean; suspended: boolean; approval: boolean;
  bookings30: number; upcoming: number; bookingsTotal: number; customers: number; lastBookingAt: string | null;
};
type BRow = { id: string; date: string; time: string; service: string; priceCents: number | null; source: string; note: string; status: string; customer: string; phone: string; createdAt: string };
type Detail = {
  business: {
    id: string; slug: string; name: string; category: string; city: string; address: string; description: string; phone: string; instagram: string; url: string;
    createdAt: string; onboarded: boolean; paused: boolean; listed: boolean; approval: boolean; demo?: boolean; suspended: { at: string; reason: string } | null;
    rules: { slotStepMin: number; minNoticeMin: number; maxAdvanceDays: number; cancelCutoffMin: number };
  };
  owner: { name: string; phone: string; lastLoginAt: string | null; createdAt: string } | null;
  staff: { name: string; active: boolean }[];
  services: { name: string; durationMin: number; priceCents: number | null; priceFrom: boolean; active: boolean }[];
  hours: { days: { weekday: number; open: boolean; start: string; end: string }[]; pause: { on: boolean; start: string; end: string } };
  daysOff: { id: string; from: string; to: string; days: number; reason: string }[];
  stats: { total: number; upcoming: number; completed: number; noShows: number; cancelled: number; customers: number; revenue30Cents: number };
  upcoming: BRow[]; past: BRow[];
  customers: { id: string; name: string; phone: string; visits: number; noShows: number; blocked: boolean; lastVisit: string | null; note: string }[];
  events: { type: string; actor: string; at: string; customer: string; service: string; when: string }[];
};
type AuditRow = { id: string; at: string; action: string; targetType: string; targetId: string; who: string; meta: Record<string, unknown> };

/* ---- small helpers ----------------------------------------------------------------------- */
const localDate = (iso: string) => toLocal(new Date(iso)).date;
const today = () => toLocal(new Date()).date;
function ago(iso: string | null): string {
  if (!iso) return t.never;
  const d = localDate(iso), now = today();
  const days = Math.round((Date.parse(now) - Date.parse(d)) / 864e5);
  if (days <= 0) return `sot ${toLocal(new Date(iso)).time}`;
  if (days === 1) return 'dje';
  if (days < 7) return `${days} ditë më parë`;
  return fmtDayMonth(d);
}
const dayLabel = (date: string) => {
  const n = Math.round((Date.parse(date) - Date.parse(today())) / 864e5);
  return n === 0 ? 'Sot' : n === 1 ? 'Nesër' : `${DAYS_SHORT[(new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7]}, ${fmtDayMonth(date)}`;
};
const eur = (c: number) => fmtPrice(c);
const statusBadge = (s: string) => (s === 'confirmed' ? 'badge--ok' : s === 'pending' ? 'badge--new' : s === 'no_show' || s.startsWith('cancelled') || s === 'expired' ? 'badge--danger' : '');
const waLink = (display: string, text = '') => `https://wa.me/${display.replace(/\D/g, '').replace(/^0/, '383')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

function BizBadges({ b }: { b: { suspended: unknown; paused: boolean; onboarded: boolean; approval: boolean } }) {
  return (
    <>
      {b.suspended ? <span className="badge badge--danger">{t.badge.suspended}</span>
        : b.paused ? <span className="badge badge--new">{t.badge.paused}</span>
        : !b.onboarded ? <span className="badge">{t.badge.setup}</span>
        : <span className="badge badge--ok">{t.badge.live}</span>}
      {b.approval && <span className="badge badge--info">{t.badge.approval}</span>}
    </>
  );
}

/* ==================================================================================== panel */
export default function SuperAdmin({ hasBusiness, priceCents, faqjaGati, adminName, initialTab = '', initialBiz = '' }: { hasBusiness: boolean; priceCents: number; faqjaGati: boolean; adminName: string; initialTab?: string; initialBiz?: string }) {
  const tabs = faqjaGati ? ['overview', 'businesses', 'listings', 'audit', 'pages'] : ['overview', 'businesses', 'listings', 'audit'];
  const [tab, setTab] = useState(initialBiz ? 'businesses' : tabs.includes(initialTab) ? initialTab : 'overview');
  const [openId, setOpenId] = useState(initialBiz);

  // Remember the open tab / business in the address, so a refresh or the back button keeps the place.
  useEffect(() => {
    const onPop = () => { const p = new URLSearchParams(window.location.search); setOpenId(p.get('biznes') || ''); setTab(p.get('tab') || (p.get('biznes') ? 'businesses' : 'overview')); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = useCallback((nextTab: string, biz = '') => {
    setTab(nextTab); setOpenId(biz);
    const url = biz ? `/admin?biznes=${encodeURIComponent(biz)}` : nextTab === 'overview' ? '/admin' : `/admin?tab=${nextTab}`;
    window.history.pushState(null, '', url);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="page page--subtle">
      <div className="app app--wide">
        <header className="topbar">
          <span className="grow sa-brand"><Wordmark small /><span className="badge badge--accent">{t.role}</span></span>
          {hasBusiness && <a className="btn btn--secondary btn--sm btn--auto" href="/app">{sq.tabs.calendar}</a>}
          <button className="btn btn--secondary btn--sm btn--auto" type="button"
            onClick={async () => { await api('/auth/logout', { body: {} }).catch(() => undefined); window.location.href = '/hyr'; }}>
            {sq.settings.logout}
          </button>
        </header>
        <main className="app__pad stack stack--6 sa" style={{ paddingTop: 8, paddingBottom: 48 }}>
          <div className="sa-head">
            <h1 className="t-h1">{t.title}</h1>
            {adminName && <p className="t-small t-3">{adminName}</p>}
          </div>
          {!openId && (
            <div className="segmented sa-tabs" role="tablist" aria-label={t.title}>
              {tabs.map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-selected' : ''} onClick={() => go(k)}>{t.tabs[k]}</button>
              ))}
            </div>
          )}
          {openId ? <BusinessDetail id={openId} onBack={() => go('businesses')} />
            : tab === 'overview' ? <OverviewTab onOpen={(id) => go('businesses', id)} onList={() => go('businesses')} />
            : tab === 'businesses' ? <BusinessesTab onOpen={(id) => go('businesses', id)} />
            : tab === 'listings' ? <AdminListings />
            : tab === 'audit' ? <AuditTab onOpen={(id) => go('businesses', id)} />
            : <FgPagesTab priceCents={priceCents} />}
        </main>
      </div>
    </div>
  );
}

/* ================================================================================= overview */
function Bars({ title, data }: { title: string; data: { date: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <section className="card sa-chart">
      <div className="split"><p className="label-caps">{title}</p><p className="t-h3 t-num">{total}</p></div>
      <div className="sa-bars" role="img" aria-label={`${title}: ${data.map((d) => `${fmtDayMonth(d.date)} ${d.n}`).join(', ')}`}>
        {data.map((d) => (
          <div key={d.date} className="sa-bars__col" title={`${fmtDayMonth(d.date)}: ${d.n}`}>
            <span className="sa-bars__bar" style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / max) * 100)}%` }} data-zero={d.n === 0 ? '' : undefined} />
          </div>
        ))}
      </div>
      <div className="split t-caption t-3"><span>{fmtDayMonth(data[0].date)}</span><span>Sot</span></div>
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: 'accent' | 'warn' }) {
  return (
    <div className={`sa-kpi${tone ? ` sa-kpi--${tone}` : ''}`}>
      <p className="sa-kpi__label">{label}</p>
      <p className="sa-kpi__value t-num">{value}</p>
      {sub && <p className="sa-kpi__sub">{sub}</p>}
    </div>
  );
}

function OverviewTab({ onOpen, onList }: { onOpen: (id: string) => void; onList: () => void }) {
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => { api<Overview>('/admin/overview').then(setO).catch(toastError); }, []);
  if (!o) return <div className="sa-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 112, borderRadius: 20 }} />)}</div>;
  const attention = o.businesses.suspended + o.businesses.paused + o.bookings.pending;
  return (
    <>
      <div className="sa-kpis">
        <Kpi tone="accent" label={t.kpiBusinesses} value={o.businesses.total} sub={`${t.kpiLive(o.businesses.live)} · ${t.kpiNew(o.businesses.new7)}`} />
        <Kpi label={t.kpiToday} value={o.bookings.today} sub={`${t.kpiWeek(o.bookings.week)} · ${t.kpiMonth(o.bookings.month)}`} />
        <Kpi label={t.kpiUpcoming} value={o.bookings.upcoming7} sub={t.kpiPending(o.bookings.pending)} tone={o.bookings.pending ? 'warn' : undefined} />
        <Kpi label={t.kpiCustomers} value={o.customers} sub={t.kpiOwners(o.owners)} />
      </div>
      {attention > 0 && (
        <button className="card sa-attn" onClick={onList}>
          <Icon name="alert" />
          <span className="grow">
            <span className="t-h3">{t.kpiAttention}</span>
            <span className="t-small t-2 sa-attn__list">
              {o.businesses.suspended > 0 && <span>{t.kpiSuspended(o.businesses.suspended)}</span>}
              {o.businesses.paused > 0 && <span>{t.kpiPaused(o.businesses.paused)}</span>}
              {o.bookings.pending > 0 && <span>{t.kpiPending(o.bookings.pending)}</span>}
              {o.businesses.approval > 0 && <span>{t.kpiApproval(o.businesses.approval)}</span>}
            </span>
          </span>
          <Icon name="chevron-right" size="sm" />
        </button>
      )}
      <div className="sa-two">
        <Bars title={t.chartBookings} data={o.bookingsPerDay} />
        <Bars title={t.chartSignups} data={o.signups} />
      </div>
      <div className="sa-two">
        <section className="stack stack--3">
          <p className="label-caps">{t.top}</p>
          {o.top.length === 0 ? <p className="card t-small t-3">{t.nothingYet}</p> : (
            <ul className="list--card">
              {o.top.map((b, i) => (
                <li key={b.id}><button className="row" onClick={() => onOpen(b.id!)}>
                  <span className="sa-rank t-num">{i + 1}</span>
                  <span className="row__main"><span className="row__title">{b.name}</span><span className="row__meta">{b.city}</span></span>
                  <span className="t-small t-2 t-num">{t.bookingsN(b.bookings)}</span>
                  <Icon name="chevron-right" size="sm" className="row__chev" />
                </button></li>
              ))}
            </ul>
          )}
        </section>
        <section className="stack stack--3">
          <p className="label-caps">{t.newest}</p>
          {o.newest.length === 0 ? <p className="card t-small t-3">{t.nothingYet}</p> : (
            <ul className="list--card">
              {o.newest.map((b) => (
                <li key={b.id}><button className="row" onClick={() => onOpen(b.id)}>
                  <span className="row__main"><span className="row__title">{b.name}</span><span className="row__meta">{sq.categories[b.category] || b.category} · {b.city}</span></span>
                  <span className="t-small t-3">{ago(b.createdAt)}</span>
                  <Icon name="chevron-right" size="sm" className="row__chev" />
                </button></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/* =============================================================================== businesses */
function BusinessesTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('new');
  const [data, setData] = useState<{ businesses: BizRow[]; cities: string[]; total: number } | null>(null);

  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  useEffect(() => {
    const p = new URLSearchParams({ status, sort });
    if (debounced) p.set('q', debounced);
    if (city) p.set('city', city);
    if (category) p.set('category', category);
    let live = true;
    api<{ businesses: BizRow[]; cities: string[]; total: number }>(`/admin/businesses?${p}`).then((r) => { if (live) setData(r); }).catch(toastError);
    return () => { live = false; };
  }, [debounced, city, category, status, sort]);

  return (
    <div className="stack stack--4">
      <div className="sa-filters">
        <label className="inputgroup sa-search">
          <span className="inputgroup__ad"><Icon name="search" size="sm" /></span>
          <input className="input" type="search" placeholder={t.search} aria-label={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input" aria-label={t.allCities} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">{t.allCities}</option>
          {(data?.cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" aria-label={t.allCategories} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t.allCategories}</option>
          {Object.entries(sq.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" aria-label={t.sortLabel} value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(t.sort).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="chips chips--wrap" role="group" aria-label={t.tabs.businesses}>
        {Object.entries(t.filter).map(([k, v]) => (
          <button key={k} className={`chip${status === k ? ' is-selected' : ''}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{v}</button>
        ))}
      </div>
      {data === null ? <div className="skeleton" style={{ height: 320, borderRadius: 20 }} /> : (
        <>
          <p className="t-small t-3" aria-live="polite">{t.count(data.businesses.length, data.total)}</p>
          {data.businesses.length === 0 ? <section className="card empty"><p className="empty__title">{t.noMatch}</p></section> : (
            <div className="sa-table" role="table" aria-label={t.tabs.businesses}>
              <div className="sa-table__head" role="row">
                <span role="columnheader">{t.col.business}</span><span role="columnheader">{t.col.owner}</span>
                <span role="columnheader" className="sa-num">{t.col.b30}</span><span role="columnheader" className="sa-num">{t.col.upcoming}</span>
                <span role="columnheader" className="sa-num">{t.col.customers}</span><span role="columnheader">{t.col.last}</span><span role="columnheader" aria-hidden="true" />
              </div>
              {data.businesses.map((b) => (
                <button key={b.id} className="sa-table__row" role="row" onClick={() => onOpen(b.id)}>
                  <span role="cell" className="sa-cell-main">
                    <span className="sa-cell-title">{b.name}</span>
                    <span className="sa-cell-meta">{sq.categoriesShort[b.category] || b.category} · {b.city} · {t.col.joined.toLowerCase()} {fmtDayMonth(localDate(b.createdAt))}</span>
                    <span className="sa-cell-badges"><BizBadges b={b} /></span>
                  </span>
                  <span role="cell" className="sa-cell-owner"><span>{b.owner || '–'}</span><span className="sa-cell-meta t-num">{b.ownerPhone}</span></span>
                  <span role="cell" className="sa-num t-num" data-label={t.col.b30}>{b.bookings30}</span>
                  <span role="cell" className="sa-num t-num" data-label={t.col.upcoming}>{b.upcoming}</span>
                  <span role="cell" className="sa-num t-num" data-label={t.col.customers}>{b.customers}</span>
                  <span role="cell" className="sa-cell-meta" data-label={t.col.last}>{ago(b.lastBookingAt)}</span>
                  <span role="cell" className="sa-cell-chev" aria-hidden="true"><Icon name="chevron-right" size="sm" /></span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ========================================================================== one business */
function BusinessDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [sub, setSub] = useState('calendar');
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api<Detail>(`/admin/businesses/${id}`).then(setD).catch((e) => { setFailed(true); toastError(e); }); }, [id]);
  useEffect(() => { load(); }, [load]);

  async function suspend() {
    setBusy(true);
    try { await api(`/admin/businesses/${id}/suspend`, { body: { reason } }); toast(t.suspendedToast); setSuspending(false); setReason(''); load(); } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function unsuspend() {
    try { await api(`/admin/businesses/${id}/unsuspend`, { body: {} }); toast(t.unsuspendedToast); load(); } catch (e) { toastError(e); }
  }
  // v7: hide a test business from the public lists (its own link keeps working)
  async function setDemo(demo: boolean) {
    try { await api(`/admin/businesses/${id}/demo`, { body: { demo } }); toast(demo ? sq.g.demoOn : sq.g.demoOff); load(); } catch (e) { toastError(e); }
  }

  const upcomingByDay = useMemo(() => {
    const out: { date: string; rows: BRow[] }[] = [];
    for (const r of d?.upcoming || []) { const last = out[out.length - 1]; if (last && last.date === r.date) last.rows.push(r); else out.push({ date: r.date, rows: [r] }); }
    return out;
  }, [d]);

  const back = <button className="btn btn--ghost btn--sm btn--auto sa-back" onClick={onBack}><Icon name="chevron-left" size="sm" />{t.back}</button>;
  if (failed) return <div className="stack">{back}<section className="card empty"><p className="empty__title">{sq.errors.not_found}</p></section></div>;
  if (!d) return <div className="stack">{back}<div className="skeleton" style={{ height: 180, borderRadius: 20 }} /><div className="skeleton" style={{ height: 320, borderRadius: 20 }} /></div>;
  const b = d.business;

  return (
    <div className="stack stack--5">
      {back}
      <section className="card sa-bizhead">
        <div className="sa-bizhead__top">
          <div className="stack stack--2">
            <h2 className="t-h2">{b.name}</h2>
            <p className="t-small t-2">{sq.categories[b.category] || b.category} · {b.city}{b.address ? ` · ${b.address}` : ''}</p>
            <div className="sa-cell-badges"><BizBadges b={{ ...b, suspended: b.suspended }} />{b.demo && <span className="badge">{sq.g.demo}</span>}</div>
          </div>
          <div className="sa-actions">
            <a className="btn btn--secondary btn--sm" href={b.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size="sm" />{t.openPublic}</a>
            {d.owner && <a className="btn btn--whatsapp btn--sm" href={waLink(d.owner.phone)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.waOwner}</a>}
            <button className="btn btn--secondary btn--sm" onClick={() => setDemo(!b.demo)}>{b.demo ? sq.g.unDemo : sq.g.makeDemo}</button>
            {b.suspended
              ? <button className="btn btn--primary btn--sm" onClick={unsuspend}>{t.unsuspend}</button>
              : <button className="btn btn--danger btn--sm" onClick={() => setSuspending(true)}>{t.suspend}</button>}
          </div>
        </div>
        {b.suspended && (
          <p className="note note--danger" role="status">{t.suspendedSince(fmtDayMonth(localDate(b.suspended.at)))}{b.suspended.reason ? ` · ${b.suspended.reason}` : ''}</p>
        )}
        <p className="t-caption t-3 sa-readonly"><Icon name="eye" size="xs" />{t.readOnly}</p>
      </section>

      <div className="sa-kpis sa-kpis--6">
        <Kpi label={t.stat.upcoming} value={d.stats.upcoming} />
        <Kpi label={t.stat.completed} value={d.stats.completed} />
        <Kpi label={t.stat.noShows} value={d.stats.noShows} />
        <Kpi label={t.stat.cancelled} value={d.stats.cancelled} />
        <Kpi label={t.stat.customers} value={d.stats.customers} />
        <Kpi label={t.stat.revenue} value={eur(d.stats.revenue30Cents)} />
      </div>

      <div className="segmented" role="tablist" aria-label={b.name}>
        {Object.entries(t.detailTabs).map(([k, v]) => <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'is-selected' : ''} onClick={() => setSub(k)}>{v}</button>)}
      </div>

      {sub === 'calendar' && (
        upcomingByDay.length === 0 ? <section className="card empty"><p className="empty__title">{t.noUpcoming}</p></section> : (
          <div className="stack stack--5">
            {upcomingByDay.map((g) => (
              <section key={g.date} className="stack stack--2">
                <p className="label-caps">{dayLabel(g.date)} · {g.rows.length}</p>
                <ul className="list--card">{g.rows.map((r) => <BookingRow key={r.id} r={r} />)}</ul>
              </section>
            ))}
          </div>
        )
      )}

      {sub === 'customers' && (
        d.customers.length === 0 ? <section className="card empty"><p className="empty__title">{t.noCustomers}</p></section> : (
          <ul className="list--card">
            {d.customers.map((c) => (
              <li className="row" key={c.id}>
                <span className="sa-avatar" aria-hidden="true">{c.name.slice(0, 1).toUpperCase()}</span>
                <span className="row__main">
                  <span className="row__title">{c.name}{c.blocked && <span className="badge badge--danger" style={{ marginLeft: 8 }}>{t.blocked}</span>}</span>
                  <span className="row__meta t-num">{c.phone || sq.calendar.walkIn} · {t.visits(c.visits)}{c.noShows ? ` · ${t.noShowsN(c.noShows)}` : ''}</span>
                  {c.note && <span className="row__meta t-3">{c.note}</span>}
                </span>
                <span className="t-small t-3">{c.lastVisit ? fmtDayMonth(c.lastVisit) : ''}</span>
              </li>
            ))}
          </ul>
        )
      )}

      {sub === 'history' && (
        <div className="sa-two">
          <section className="stack stack--3">
            <p className="label-caps">{t.pastBookings}</p>
            {d.past.length === 0 ? <p className="card t-small t-3">{t.noHistory}</p> : <ul className="list--card">{d.past.map((r) => <BookingRow key={r.id} r={r} withDate />)}</ul>}
          </section>
          <section className="stack stack--3">
            <p className="label-caps">{t.activity}</p>
            {d.events.length === 0 ? <p className="card t-small t-3">{t.noHistory}</p> : (
              <ol className="card sa-timeline">
                {d.events.map((e, i) => (
                  <li key={i}>
                    <span className="sa-timeline__dot" data-type={e.type} />
                    <span className="stack stack--1">
                      <span className="t-small"><b>{t.events[e.type] || e.type}</b> · {e.customer} · {e.service}</span>
                      <span className="t-caption t-3">{t.actor[e.actor] || e.actor} · {ago(e.at)} · termini {fmtDayMonth(e.when.slice(0, 10))} {e.when.slice(11)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {sub === 'info' && (
        <div className="sa-two">
          <section className="card stack stack--2">
            <p className="label-caps">{t.owner}</p>
            <dl>
              <div className="kv"><dt>{sq.calendar.clientName}</dt><dd>{d.owner?.name || '–'}</dd></div>
              <div className="kv"><dt>{sq.calendar.phone}</dt><dd className="t-num">{d.owner?.phone || '–'}</dd></div>
              <div className="kv"><dt>{t.lastLogin}</dt><dd>{ago(d.owner?.lastLoginAt || null)}</dd></div>
              <div className="kv"><dt>{t.joined}</dt><dd>{fmtDayMonth(localDate(b.createdAt))}</dd></div>
              <div className="kv"><dt>{sq.settings.yourLink}</dt><dd className="t-num"><a className="link" href={b.url} target="_blank" rel="noopener noreferrer">/b/{b.slug}</a></dd></div>
              {b.instagram && <div className="kv"><dt>Instagram</dt><dd>@{b.instagram}</dd></div>}
            </dl>
          </section>
          <section className="card stack stack--2">
            <p className="label-caps">{t.rules}</p>
            <dl>
              <div className="kv"><dt>{t.ruleAdvance}</dt><dd>{sq.settings.days(b.rules.maxAdvanceDays)}</dd></div>
              <div className="kv"><dt>{t.ruleNotice}</dt><dd>{fmtDuration(b.rules.minNoticeMin)}</dd></div>
              <div className="kv"><dt>{t.ruleCancel}</dt><dd>{fmtDuration(b.rules.cancelCutoffMin)}</dd></div>
              <div className="kv"><dt>{t.ruleStep}</dt><dd>{b.rules.slotStepMin} min</dd></div>
              <div className="kv"><dt>{sq.settings.approval}</dt><dd>{b.approval ? t.yes : t.no}</dd></div>
              <div className="kv"><dt>{t.listed}</dt><dd>{b.listed ? t.yes : t.no}</dd></div>
            </dl>
          </section>
          <section className="card stack stack--2">
            <p className="label-caps">{t.hours}</p>
            <dl>
              {d.hours.days.map((h) => (
                <div className="kv" key={h.weekday}><dt>{DAYS_SHORT[h.weekday - 1]}</dt><dd className="t-num">{h.open ? `${h.start} – ${h.end}${d.hours.pause.on ? ` (${sq.settings.pause.toLowerCase()} ${d.hours.pause.start}–${d.hours.pause.end})` : ''}` : <span className="t-3">{t.closed}</span>}</dd></div>
              ))}
            </dl>
            {d.daysOff.length > 0 && <p className="t-small t-2">{t.daysOff}: {d.daysOff.map((o) => o.from === o.to ? fmtDayMonth(o.from) : `${fmtDayMonth(o.from)} – ${fmtDayMonth(o.to)}`).join(', ')}</p>}
          </section>
          <section className="card stack stack--2">
            <p className="label-caps">{t.services}</p>
            <dl>
              {d.services.map((s, i) => (
                <div className="kv" key={i}><dt className={s.active ? '' : 't-3'}>{s.name}</dt><dd className="t-num">{fmtDuration(s.durationMin)} · {s.priceCents === null ? '–' : fmtPrice(s.priceCents, s.priceFrom)}</dd></div>
              ))}
            </dl>
            {d.staff.length > 1 && <p className="t-small t-2">{t.staff}: {d.staff.map((s) => s.name).join(', ')}</p>}
          </section>
        </div>
      )}

      <Sheet open={suspending} onClose={() => setSuspending(false)} title={t.suspendTitle} closeButton
        actions={<button className={`btn btn--danger${busy ? ' is-loading' : ''}`} disabled={busy} onClick={suspend}>{t.confirmSuspend}</button>}>
        <div className="stack">
          <p className="t-2">{b.name}. {t.suspendText}</p>
          <Field label={t.reason} small={sq.common.optional} htmlFor="sa-reason">
            <input className="input" id="sa-reason" placeholder={t.reasonPh} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}

function BookingRow({ r, withDate }: { r: BRow; withDate?: boolean }) {
  return (
    <li className="row sa-brow">
      <span className="sa-brow__time t-num">{withDate && <span className="t-caption t-3">{fmtDayMonth(r.date)}</span>}{r.time}</span>
      <span className="row__main">
        <span className="row__title">{r.customer}</span>
        <span className="row__meta">{r.service}{r.priceCents !== null ? ` · ${fmtPrice(r.priceCents)}` : ''} · {t.source[r.source] || r.source}</span>
        {r.phone && <span className="row__meta t-3 t-num">{r.phone}</span>}
        {r.note && <span className="row__meta t-3">“{r.note}”</span>}
      </span>
      <span className={`badge ${statusBadge(r.status)}`}>{t.bstatus[r.status] || r.status}</span>
    </li>
  );
}

/* ================================================================================= audit log */
function AuditTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => { api<{ entries: AuditRow[] }>('/admin/audit').then((r) => setRows(r.entries)).catch(toastError); }, []);
  if (rows === null) return <div className="skeleton" style={{ height: 320, borderRadius: 20 }} />;
  return (
    <div className="stack stack--3">
      <p className="t-small t-3">{t.auditHint}</p>
      {rows.length === 0 ? <section className="card empty"><p className="empty__title">{t.noAudit}</p></section> : (
        <ul className="list--card">
          {rows.map((r) => {
            const name = typeof r.meta.name === 'string' ? r.meta.name : '';
            const reason = typeof r.meta.reason === 'string' && r.meta.reason ? ` · ${r.meta.reason}` : '';
            const canOpen = r.targetType === 'business';
            const inner = (
              <>
                <span className="row__main">
                  <span className="row__title row__title--plain">{t.auditAction[r.action] || r.action}{name ? `: ${name}` : ''}</span>
                  <span className="row__meta">{r.who || '–'} · {ago(r.at)}{reason}</span>
                </span>
                {canOpen && <Icon name="chevron-right" size="sm" className="row__chev" />}
              </>
            );
            return <li key={r.id}>{canOpen ? <button className="row" onClick={() => onOpen(r.targetId)}>{inner}</button> : <div className="row">{inner}</div>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
