'use client';
// Cilësimet (fable/termini-ui/settings.html, 01-product-design.md §4.5). One component, four routes:
//   main → /app/cilesimet · orari → hours, pause, days off · rezervimet → booking rules · profili → profile.
// Saving rule (from Fable's file): a switch or a choice saves at once ("U ruajt."); typed fields and the weekly
// hours are saved with "Ruaj" in the bottom bar.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { HoursList } from '@/components/Onboarding';
import { ApiError, Field, Icon, PhoneInput, Sheet, Switch, TimeSelect, api, copyText, toast, toastError } from '@/components/ui';
import type { SettingsData } from '@/lib/settings-data';
import { sq } from '@/lib/sq';
import { shrinkPhoto } from '@/components/shrink';
import { DAYS, addDays, cap, fmtDayMonth, today as todayOf, weekdayOf } from '@/lib/time';

const t = sq.settings;
export type SettingsView = 'main' | 'orari' | 'rezervimet' | 'profili';
type Day = { weekday: number; open: boolean; start: string; end: string };
type HoursDoc = { days: Day[]; pause: { on: boolean; start: string; end: string } };
type DayOff = { id: string; from: string; to: string; days: number; reason: string };

/** Kosovo public holidays + the two Bajrams (approximate, offered as one-tap suggestions only, §5). */
const FIXED: [string, string][] = [['01-01', 'Viti i Ri'], ['01-07', 'Krishtlindjet ortodokse'], ['02-17', 'Dita e Pavarësisë'], ['04-09', 'Dita e Kushtetutës'], ['05-01', 'Dita e Punës'], ['05-09', 'Dita e Evropës'], ['11-28', 'Dita e Flamurit'], ['12-25', 'Krishtlindjet']];
// Audit fix: the names were swapped. Ramazan Bajrami (after Ramadan, Eid al-Fitr) = "Bajrami i Vogël";
// Kurban Bajrami (Eid al-Adha, ~70 days later) = "Bajrami i Madh". Easter (both churches) was missing.
// Approximate: Bajram can move by one day; check the dates each December and extend the list.
const MOVING: [string, string][] = [
  ['2026-03-20', 'Bajrami i Vogël'], ['2026-05-27', 'Bajrami i Madh'], ['2027-03-10', 'Bajrami i Vogël'], ['2027-05-17', 'Bajrami i Madh'],
  ['2028-02-27', 'Bajrami i Vogël'], ['2028-05-05', 'Bajrami i Madh'],
  ['2027-03-28', 'Pashkët katolike'], ['2027-05-02', 'Pashkët ortodokse'], ['2028-04-16', 'Pashkët'],
];
function suggestions(today: string, taken: DayOff[]) {
  const y = Number(today.slice(0, 4));
  const all: [string, string][] = [...MOVING];
  for (const yr of [y, y + 1]) for (const [md, name] of FIXED) all.push([`${yr}-${md}`, name]);
  const limit = addDays(today, 120);
  return all
    .filter(([d]) => d > today && d <= limit && !taken.some((o) => d >= o.from && d <= o.to))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, 4);
}
const offTitle = (o: DayOff) => {
  if (o.from === o.to) return fmtDayMonth(o.from);
  const sameMonth = o.from.slice(0, 7) === o.to.slice(0, 7);
  return `${sameMonth ? Number(o.from.slice(8)) : fmtDayMonth(o.from)} – ${fmtDayMonth(o.to)}`;
};
const offMeta = (o: DayOff) => [o.days === 1 ? cap(DAYS[weekdayOf(o.from) - 1]) : t.nDays(o.days), o.reason].filter(Boolean).join(' · ');

export default function Settings({ view, data }: { view: SettingsView; data: SettingsData }) {
  if (view === 'orari') return <HoursView />;
  if (view === 'rezervimet') return <RulesView data={data} />;
  if (view === 'profili') return <ProfileView data={data} />;
  return <MainView data={data} />;
}

function SubTop({ title }: { title: string }) {
  return (
    <header className="topbar">
      <Link className="iconbtn" href="/app/cilesimet" aria-label={t.backToSettings}><Icon name="chevron-left" /></Link>
      <h1 className="topbar__title">{title}</h1>
    </header>
  );
}

/* ================================================================================ main */
function MainView({ data }: { data: SettingsData }) {
  const b = data.business;
  const [paused, setPaused] = useState(b.bookingsPaused);
  const [sheet, setSheet] = useState<'' | 'logout' | 'delete'>('');
  const [confirm, setConfirm] = useState('');
  const shareText = sq.wa.share({ business: b.name, link: data.link.url });

  async function setOnline(on: boolean, silent = false) {
    setPaused(!on);
    try {
      await api('/business', { method: 'PATCH', body: { bookingsPaused: !on } });
      if (!silent) toast(on ? t.onlineOpened : t.onlineStopped, { action: sq.common.undo, onAction: () => setOnline(!on, true) });
    } catch (e) { setPaused(on); toastError(e); }
  }
  async function logout() {
    await api('/auth/logout', { body: {} }).catch(() => undefined);
    window.location.href = '/';
  }
  async function remove() {
    try { await api('/business', { method: 'DELETE', body: { confirm } }); window.location.href = '/'; } catch (e) { toastError(e); }
  }

  const page = data.page;
  return (
    <>
      <div className="app app--tabs">
        <header className="topbar"><h1 className="t-h2 grow">{t.title}</h1></header>
        <main className="app__pad stack stack--6" style={{ paddingTop: 12 }}>
          <section className="linkbox" aria-label={t.myLink}>
            <p className="t-caption" style={{ opacity: 0.6, marginBottom: 8 }}>{t.yourLink}</p>
            <p className="linkbox__url">{data.link.prefix}<b>{b.slug}</b></p>
            <div className="linkbox__actions">
              <button className="btn" onClick={() => copyText(data.link.url)}><Icon name="copy" size="sm" />{t.copy}</button>
              <a className="btn" href="/api/business/qr.svg?download=1" download><Icon name="qr" size="sm" />{t.qr}</a>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size="sm" />{t.share}</a>
            </div>
          </section>

          <section className="list--card">
            <div className="row">
              <span className="row__main"><span className="row__title row__title--plain" id="online-l">{t.online}</span><span className="row__meta">{paused ? t.onlineOff : t.onlineOn}</span></span>
              <Switch checked={!paused} onChange={(v) => setOnline(v)} labelledBy="online-l" />
            </div>
          </section>

          <section className="group">
            <h2 className="label-caps group__label">{t.groupBookings}</h2>
            <div className="list--card">
              <Link className="row" href="/app/cilesimet/orari">
                <span className="row__main"><span className="row__title row__title--plain">{t.hours}</span><span className="row__meta">{data.hoursSummary ? t.hoursMeta(data.hoursSummary.days, data.hoursSummary.from) : t.hoursNone}</span></span>
                <span className="row__end"><Icon name="chevron-right" /></span>
              </Link>
              <Link className="row" href="/app/cilesimet/orari#pushime">
                <span className="row__main"><span className="row__title row__title--plain">{t.daysOff}</span><span className="row__meta">{data.nextDayOff ? t.nextOff(data.nextDayOff) : t.noOff}</span></span>
                <span className="row__end"><Icon name="chevron-right" /></span>
              </Link>
              <Link className="row" href="/app/cilesimet/rezervimet">
                <span className="row__main"><span className="row__title row__title--plain">{t.rules}</span><span className="row__meta">{t.rulesMeta(b.maxAdvanceDays, sq.durationsShort[b.cancelCutoffMin] || `${b.cancelCutoffMin} min`)}</span></span>
                <span className="row__end"><Icon name="chevron-right" /></span>
              </Link>
            </div>
          </section>

          <section className="group">
            <h2 className="label-caps group__label">{t.groupBiz}</h2>
            <div className="list--card">
              <Link className="row" href="/app/cilesimet/profili">
                <span className="avatar avatar--ink" aria-hidden="true">{b.photoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.photoUrl} alt="" /> : b.name.charAt(0).toUpperCase()}</span>
                <span className="row__main"><span className="row__title row__title--plain">{t.profile}</span><span className="row__meta">{t.profileMeta}</span></span>
                <span className="row__end"><Icon name="chevron-right" /></span>
              </Link>
              <div className="row">
                <span className="row__main"><span className="row__title row__title--plain">{t.staff}</span><span className="row__meta">{t.staffMeta}</span></span>
                <span className="badge">{sq.common.soon}</span>
              </div>
            </div>
          </section>

          <a className="banner" href={page ? (page.liveUrl || `/faqja/${page.id}`) : '/faqja/krijo'} target={page?.liveUrl ? '_blank' : undefined} rel="noopener">
            <Icon name="sparkles" />
            <span className="banner__text">
              <b>{page ? (page.status === 'live' ? t.bannerLive : t.bannerPreview) : t.bannerTitle}</b>
              <span>{page ? (page.status === 'live' ? page.liveUrl.replace(/^https?:\/\//, '') : t.bannerPreviewText) : t.bannerText}</span>
            </span>
            <Icon name="chevron-right" style={{ color: '#fff', opacity: 0.6 }} />
          </a>

          <section className="group">
            <h2 className="label-caps group__label">{t.groupAccount}</h2>
            <div className="list--card">
              <div className="row">
                <span className="row__main"><span className="row__title row__title--plain">{data.user.name || b.name}</span><span className="row__meta t-num">{data.user.phone}</span></span>
              </div>
              {data.user.role === 'admin' && (
                <Link className="row" href="/admin">
                  <span className="row__main"><span className="row__title row__title--plain">{t.admin}</span></span>
                  <span className="row__end"><Icon name="chevron-right" /></span>
                </Link>
              )}
              <a className="row" href={`https://wa.me/${data.supportWa}?text=${encodeURIComponent(sq.wa.support)}`} target="_blank" rel="noopener noreferrer">
                <span className="row__main"><span className="row__title row__title--plain">{t.writeUs}</span><span className="row__meta">{t.writeUsMeta}</span></span>
                <span className="row__end"><Icon name="chevron-right" /></span>
              </a>
              <button className="row" onClick={() => setSheet('logout')}>
                <span className="row__main"><span className="row__title row__title--plain">{t.logout}</span></span>
              </button>
            </div>
            <p className="t-center" style={{ paddingTop: 8 }}><button className="link link--danger t-small" style={{ minHeight: 44 }} onClick={() => { setConfirm(''); setSheet('delete'); }}>{t.deleteAccount}</button></p>
          </section>
        </main>
      </div>

      <Sheet open={sheet === 'logout'} onClose={() => setSheet('')} title={t.logoutTitle}
        actions={<>
          <button className="btn btn--secondary" onClick={logout}>{t.yesLogout}</button>
          <button className="btn btn--primary" onClick={() => setSheet('')}>{t.noStay}</button>
        </>}>
        <p className="t-2">{t.logoutText(data.user.phone)}</p>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet('')} title={t.deleteTitle}
        actions={<>
          <button className="btn btn--danger" disabled={confirm.trim().toUpperCase() !== t.deleteWord} onClick={remove}>{t.deleteForever}</button>
          <button className="btn btn--secondary" onClick={() => setSheet('')}>{t.noKeep}</button>
        </>}>
        <div className="stack">
          <p className="t-2">{t.deleteText}</p>
          <Field label={t.deleteConfirm} htmlFor="dc">
            <input className="input" id="dc" autoComplete="off" autoCapitalize="characters" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </>
  );
}

/* ================================================================================ orari */
function HoursView() {
  const [doc, setDoc] = useState<HoursDoc | null>(null);
  const [off, setOff] = useState<DayOff[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const today = todayOf();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');
  const [clash, setClash] = useState('');

  useEffect(() => {
    api<HoursDoc>('/hours').then(setDoc).catch(toastError);
    api<{ daysOff: DayOff[] }>('/time-off').then((r) => setOff(r.daysOff)).catch(toastError);
  }, []);

  const patchDay = (weekday: number, p: Partial<Day>) => { setErr(''); setDoc((d) => d && { ...d, days: d.days.map((x) => (x.weekday === weekday ? { ...x, ...p } : x)) }); };
  const patchPause = (p: Partial<HoursDoc['pause']>) => setDoc((d) => d && { ...d, pause: { ...d.pause, ...p } });

  async function save() {
    if (!doc) return;
    if (doc.days.some((d) => d.open && d.end <= d.start) || (doc.pause.on && doc.pause.end <= doc.pause.start)) { setErr(sq.errors.hours_order); return; }
    setBusy(true);
    try { setDoc(await api<HoursDoc>('/hours', { method: 'PUT', body: doc })); toast(sq.common.saved); }
    catch (e) { if (e instanceof ApiError && e.code === 'hours_order') setErr(e.message); else toast(sq.common.saveFailed, { error: true }); }
    setBusy(false);
  }

  async function addOff(f: string, tt: string, r: string, fromSheet: boolean) {
    setClash('');
    try {
      const res = await api<{ daysOff: DayOff[] }>('/time-off', { body: { from: f, to: tt, reason: r } });
      setOff(res.daysOff);
      if (fromSheet) { setSheet(false); toast(t.dayClosed); } else toast(t.dayAdded);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'day_has_bookings') { if (fromSheet) setClash(e.message); else toast(e.message, { error: true }); }
      else toastError(e);
    }
  }
  async function removeOff(o: DayOff) {
    try {
      setOff((await api<{ daysOff: DayOff[] }>(`/time-off/${o.id}`, { method: 'DELETE' })).daysOff);
      toast(t.dayRemoved, { action: sq.common.undo, onAction: () => addOff(o.from, o.to, o.reason, false) });
    } catch (e) { toastError(e); }
  }

  const sugg = suggestions(today, off);
  return (
    <>
      <div className="app app--bar">
        <SubTop title={t.hours} />
        <main className="app__pad stack stack--6" style={{ paddingTop: 8, paddingBottom: 24 }}>
          <section className="group">
            <h2 className="label-caps group__label">{t.weekHours}</h2>
            {doc ? <HoursList days={doc.days} onChange={patchDay} /> : <div className="skeleton" style={{ height: 380 }} />}
            {err && <p className="field__error" style={{ display: 'block' }} role="alert">{err}</p>}
          </section>

          {doc && (
            <section className="group">
              <h2 className="label-caps group__label">{t.pause}</h2>
              <div className="list--card">
                <div className={`hours${doc.pause.on ? '' : ' is-off'}`}>
                  <span className="hours__day"><span>{t.everyDay}</span><abbr title={t.pauseLabel}>{t.everyDay}</abbr></span>
                  <span className="hours__times">
                    <TimeSelect value={doc.pause.start} step={15} onChange={(v) => patchPause({ start: v })} label={t.pauseFrom} />
                    <span>–</span>
                    <TimeSelect value={doc.pause.end} step={15} onChange={(v) => patchPause({ end: v })} label={t.pauseTo} />
                  </span>
                  <span className="hours__closed">{t.noPause}</span>
                  <Switch checked={doc.pause.on} onChange={(v) => patchPause({ on: v })} label={t.pauseLabel} />
                </div>
              </div>
              <p className="group__hint">{t.pauseHint}</p>
            </section>
          )}

          <section className="group" id="pushime">
            <h2 className="label-caps group__label">{t.daysOff}</h2>
            {off.length > 0 && (
              <ul className="list--card">
                {off.map((o) => (
                  <li className="row" key={o.id}>
                    <span className="row__main"><span className="row__title row__title--plain">{offTitle(o)}</span><span className="row__meta">{offMeta(o)}</span></span>
                    <button className="iconbtn" aria-label={t.remove(offTitle(o))} onClick={() => removeOff(o)}><Icon name="x" size="sm" /></button>
                  </li>
                ))}
              </ul>
            )}
            {sugg.length > 0 && (
              <>
                <p className="group__hint" style={{ paddingTop: 8 }}>{t.suggest}</p>
                <div className="chips chips--wrap">
                  {sugg.map(([d, name]) => <button key={d} className="chip" onClick={() => addOff(d, d, name, false)}><Icon name="plus" size="xs" />{fmtDayMonth(d)} · {name}</button>)}
                </div>
              </>
            )}
            <button className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => { setFrom(today); setTo(today); setReason(''); setClash(''); setSheet(true); }}><Icon name="plus" size="sm" />{t.addDayOff}</button>
          </section>
        </main>
      </div>

      <div className="bar is-visible">
        <div className="bar__in"><button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy || !doc} onClick={save}>{sq.common.save}</button></div>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t.dayOffTitle} closeButton
        actions={!clash && <button className="btn btn--primary" onClick={() => addOff(from, to, reason, true)}>{t.closeDay}</button>}>
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); addOff(from, to, reason, true); }}>
          <div className="cluster" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <Field label={t.from} htmlFor="of"><input className="input t-num" id="of" type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); setClash(''); }} /></Field>
            <Field label={t.to} htmlFor="ot"><input className="input t-num" id="ot" type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setClash(''); }} /></Field>
          </div>
          <p className="field__hint" style={{ marginTop: -8 }}>{t.oneDayHint}</p>
          <Field label={t.reason} small={t.reasonOnlyYou} htmlFor="or">
            <input className="input" id="or" autoComplete="off" placeholder={t.reasonPh} value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {clash && <p className="card card--flat t-small" role="alert">{clash} <Link className="link" href="/app">{t.seeDay}</Link></p>}
          <button type="submit" hidden />
        </form>
      </Sheet>
    </>
  );
}

/* ================================================================================ rezervimet */
function RulesView({ data }: { data: SettingsData }) {
  const b = data.business;
  const [v, setV] = useState({ maxAdvanceDays: b.maxAdvanceDays, minNoticeMin: b.minNoticeMin, cancelCutoffMin: b.cancelCutoffMin, slotStepMin: b.slotStepMin, listedInFind: b.listedInFind });

  async function set<K extends keyof typeof v>(k: K, value: (typeof v)[K]) {
    const before = v[k];
    setV((x) => ({ ...x, [k]: value }));
    try { await api('/business', { method: 'PATCH', body: { [k]: value } }); toast(sq.common.saved); }
    catch (e) { setV((x) => ({ ...x, [k]: before })); toastError(e); }
  }
  const Seg = ({ k, id, options }: { k: 'maxAdvanceDays' | 'minNoticeMin' | 'cancelCutoffMin' | 'slotStepMin'; id: string; options: [number, string][] }) => (
    <div className="segmented" role="group" aria-labelledby={id}>
      {options.map(([n, label]) => <button key={n} className={v[k] === n ? 'is-selected' : ''} aria-pressed={v[k] === n} onClick={() => set(k, n)}>{label}</button>)}
    </div>
  );
  const D = sq.durationsShort;
  return (
    <div className="app">
      <SubTop title={t.rules} />
      <main className="app__pad stack stack--6" style={{ paddingTop: 8, paddingBottom: 24 }}>
        <div className="list--card">
          <div className="setting">
            <div><p className="setting__title" id="r1">{t.r1}</p></div>
            <Seg k="maxAdvanceDays" id="r1" options={[7, 14, 30, 60].map((n) => [n, t.days(n)])} />
          </div>
          <div className="setting">
            <div><p className="setting__title" id="r2">{t.r2}</p><p className="setting__hint">{t.r2Hint}</p></div>
            <Seg k="minNoticeMin" id="r2" options={[30, 60, 120, 1440].map((n) => [n, D[n]])} />
          </div>
          <div className="setting">
            <div><p className="setting__title" id="r3">{t.r3}</p><p className="setting__hint">{t.r3Hint}</p></div>
            <Seg k="cancelCutoffMin" id="r3" options={[60, 120, 360, 1440].map((n) => [n, D[n]])} />
            <p className="setting__hint" style={{ marginTop: -4 }}>{t.r3After}</p>
          </div>
          <div className="setting">
            <div><p className="setting__title" id="r4">{t.r4}</p><p className="setting__hint">{t.r4Hint}</p></div>
            <Seg k="slotStepMin" id="r4" options={[[15, '15 min'], [30, '30 min']]} />
          </div>
        </div>
        <div className="list--card">
          <div className="row">
            <span className="row__main"><span className="row__title row__title--plain" id="find-l">{t.listed}</span><span className="row__meta">{t.listedMeta}</span></span>
            <Switch checked={v.listedInFind} onChange={(x) => set('listedInFind', x)} labelledBy="find-l" />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ================================================================================ profili */
function ProfileView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const b = data.business;
  const [f, setF] = useState({ name: b.name, description: b.description, phone: b.phone, city: sq.cities.includes(b.city) ? b.city : sq.cities[sq.cities.length - 1], address: b.address, instagram: b.instagram });
  const [photo, setPhoto] = useState(b.photoUrl);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); setErrors({}); };

  async function save() {
    setBusy(true);
    try { await api('/business', { method: 'PATCH', body: f }); toast(sq.common.saved); router.refresh(); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'business_name') setErrors({ name: e.message });
      else if (e instanceof ApiError && e.code === 'invalid_phone') setErrors({ phone: e.message });
      else toast(sq.common.saveFailed, { error: true });
    }
    setBusy(false);
  }
  async function upload(fl: File | undefined) {
    if (!fl) return;
    // v4 audit: shrink on the phone first (a raw phone photo is larger than the 4.5 MB a Vercel request may carry).
    const form = new FormData(); form.append('file', await shrinkPhoto(fl, 1200), 'photo.jpg');
    try { setPhoto((await api<{ photoUrl: string }>('/business/photo', { form })).photoUrl); toast(t.photoSaved); } catch (e) { toastError(e); }
    if (file.current) file.current.value = '';
  }
  function pin() {
    if (!navigator.geolocation) { toast(t.pinFailed, { error: true }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => api('/business', { method: 'PATCH', body: { lat: pos.coords.latitude, lng: pos.coords.longitude } }).then(() => toast(t.pinSaved)).catch(toastError),
      () => toast(t.pinFailed, { error: true }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div className="app app--bar">
        <SubTop title={t.profile} />
        <form className="app__pad stack stack--6" style={{ paddingTop: 8, paddingBottom: 24 }} noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="photo">
            <span className="photo__img" aria-hidden="true">{photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" /> : b.name.charAt(0).toUpperCase()}</span>
            <div className="stack stack--2">
              <button type="button" className="btn btn--secondary btn--sm btn--auto" onClick={() => file.current?.click()}>{t.changePhoto}</button>
              <p className="t-small t-3">{t.photoHint}</p>
              <input ref={file} type="file" accept="image/*" className="sr" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
          </div>
          <div className="stack">
            <Field label={t.bizName} htmlFor="pn" error={errors.name}>
              <input className="input" id="pn" autoComplete="organization" value={f.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} aria-invalid={!!errors.name || undefined} />
            </Field>
            <Field label={t.description} small={sq.common.optional} htmlFor="pd">
              <textarea className="input" id="pd" rows={2} maxLength={140} placeholder={t.descPh} value={f.description} onChange={(e) => patch({ description: e.target.value })} />
            </Field>
            <Field label={t.publicPhone} htmlFor="pp" hint={t.publicPhoneHint} error={errors.phone}>
              <PhoneInput id="pp" value={f.phone} onChange={(v) => patch({ phone: v })} invalid={!!errors.phone} />
            </Field>
            <Field label={t.city} htmlFor="pc">
              <select className="input" id="pc" autoComplete="address-level2" value={f.city} onChange={(e) => patch({ city: e.target.value })}>
                {sq.cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t.address} htmlFor="pa" hint={t.addressHint}>
              <input className="input" id="pa" autoComplete="street-address" value={f.address} maxLength={120} onChange={(e) => patch({ address: e.target.value })} />
            </Field>
            <button type="button" className="btn btn--secondary" onClick={pin}><Icon name="pin" size="sm" />{t.pinHere}</button>
            <Field label={t.instagram} small={sq.common.ifAny} htmlFor="pi">
              <div className="inputgroup"><span className="inputgroup__ad">@</span><input className="input" id="pi" autoCapitalize="none" autoComplete="off" value={f.instagram} maxLength={60} onChange={(e) => patch({ instagram: e.target.value })} /></div>
            </Field>
          </div>
          <button type="submit" hidden />
        </form>
      </div>
      <div className="bar is-visible">
        <div className="bar__in"><button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={save}>{sq.common.save}</button></div>
      </div>
    </>
  );
}
