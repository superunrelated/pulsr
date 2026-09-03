import { Temporal } from '@js-temporal/polyfill';

// "Today" and day boundaries must reflect the device's LOCAL calendar day,
// not UTC's — `new Date().toISOString().slice(0, 10)` silently returns the
// wrong date for roughly the first half of the day in any timezone ahead of
// UTC by more than a few hours (e.g. NZ, +12/+13).

export function localTodayIso(): string {
  return Temporal.Now.plainDateISO().toString();
}

export function localTimeZone(): string {
  return Temporal.Now.timeZoneId();
}

/** UTC instant range [start, end) covering the given local calendar date. */
export function localDayUtcRange(dateIso: string): {
  startIso: string;
  endIso: string;
} {
  const date = Temporal.PlainDate.from(dateIso);
  const start = date.toZonedDateTime(localTimeZone());
  const end = start.add({ days: 1 });
  return {
    startIso: start.toInstant().toString(),
    endIso: end.toInstant().toString(),
  };
}

/** The UTC instant for local noon on the given date — safe to display back
 * via toLocaleDateString() in the same timezone without ever landing on an
 * adjacent calendar day. */
export function localNoonUtcIso(dateIso: string): string {
  const date = Temporal.PlainDate.from(dateIso);
  return date
    .toZonedDateTime({ timeZone: localTimeZone(), plainTime: '12:00' })
    .toInstant()
    .toString();
}
