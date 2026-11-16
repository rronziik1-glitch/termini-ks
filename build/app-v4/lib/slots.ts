// Slot engine (01-product-design.md §5). Pure functions: minutes after local midnight in, start times out.

export type Interval = { start: number; end: number };

/** Sort and merge overlapping or touching intervals. */
export function merge(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** base minus busy. */
export function subtract(base: Interval[], busy: Interval[]): Interval[] {
  let free = merge(base);
  for (const b of merge(busy)) {
    const next: Interval[] = [];
    for (const f of free) {
      if (b.end <= f.start || b.start >= f.end) { next.push(f); continue; }
      if (b.start > f.start) next.push({ start: f.start, end: b.start });
      if (b.end < f.end) next.push({ start: b.end, end: f.end });
    }
    free = next;
  }
  return free;
}

export type SlotInput = {
  working: Interval[];      // working intervals of that weekday (a pause = two intervals)
  busy: Interval[];         // bookings, blocks and time off, already clipped to this day
  durationMin: number;
  bufferMin?: number;
  stepMin: number;          // the business's grid: 15 or 30
  earliestMin?: number;     // now + minimum notice, when the date is today
};

/** Start times on the step grid where start + duration + buffer fits inside one free interval. */
export function slotStarts(input: SlotInput): number[] {
  const need = input.durationMin + (input.bufferMin || 0);
  const step = Math.max(5, input.stepMin || 15);
  const out: number[] = [];
  if (need <= 0) return out;
  for (const f of subtract(input.working, input.busy)) {
    let s = Math.ceil(f.start / step) * step;
    if (input.earliestMin !== undefined) s = Math.max(s, Math.ceil(input.earliestMin / step) * step);
    for (; s + need <= f.end; s += step) out.push(s);
  }
  return out;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
