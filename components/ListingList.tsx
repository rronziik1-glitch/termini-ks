// v7: real businesses that are not on Termini yet, shown under the bookable ones so the lists are never empty.
import Link from 'next/link';
import type { PublicListing } from '@/lib/listings';
import { sq } from '@/lib/sq';

export default function ListingList({ list, grid }: { list: PublicListing[]; grid?: boolean }) {
  return (
    <ul className={grid ? 'found-grid' : 'stack stack--3'}>
      {list.map((l) => (
        <li key={l.slug}>
          <Link className="found found--listing" href={`/l/${l.slug}`}>
            <span className="avatar avatar--lg" aria-hidden="true">{l.name.charAt(0).toUpperCase()}</span>
            <span className="row__main">
              <span className="row__title">{l.name}</span>
              <span className="row__meta">{sq.categoriesShort[l.category] || sq.common.other} · {l.city}</span>
            </span>
            <span className="found__next"><span className="badge badge--new">{sq.g.notOnTermini}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
