// Real businesses with their next free time (home page and "Gjej"). One tap opens the booking page on that day.
import Link from 'next/link';
import { Icon } from '@/components/ui';
import type { FoundBusiness } from '@/lib/business';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, diffDays, fmtDayMonth, fmtPrice, toLocal, weekdayOf } from '@/lib/time';

const t = sq.find;

export default function FoundList({ list, grid }: { list: FoundBusiness[]; grid?: boolean }) {
  const today = toLocal(new Date()).date;
  const whenLabel = (date: string) => { const n = diffDays(today, date); return n === 0 ? sq.common.today : n === 1 ? sq.common.tomorrow : `${DAYS_SHORT[weekdayOf(date) - 1]} ${fmtDayMonth(date)}`; };
  return (
    <ul className={grid ? 'found-grid' : 'stack stack--3'}>
      {list.map((b) => (
        <li key={b.slug}>
          <Link className="found" href={`/b/${b.slug}?nga=gjej${b.nextDate ? `&dita=${b.nextDate}` : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="avatar avatar--lg avatar--ink" aria-hidden="true">{b.photoUrl ? <img src={b.photoUrl} alt="" /> : b.name.charAt(0).toUpperCase()}</span>
            <span className="row__main">
              <span className="row__title">{b.name}</span>
              <span className="row__meta">{sq.categoriesShort[b.category] || sq.common.other} · {b.city}{b.priceFromCents !== null ? ` · ${fmtPrice(b.priceFromCents, true)}` : ''}</span>
              {b.matchedService && <span className="row__meta found__match"><Icon name="scissors" size="xs" />{b.matchedService}</span>}
            </span>
            <span className="found__next">
              {b.nextDate ? <><span>{t.nextFree}</span><b>{whenLabel(b.nextDate)} {b.nextTime}</b></> : <span>{b.paused ? t.paused : t.noFree}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
