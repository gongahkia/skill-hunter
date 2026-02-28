import type { ChronologyConflict, ChronologyEvent, ChronologyGap } from "./types.js";

const oppositeTags: Array<[string, string]> = [
  ["termination", "renewal"],
  ["payment-missed", "payment-received"],
  ["admitted", "denied"]
];

function toDate(value: string) {
  return new Date(value);
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

export function buildChronology(eventsInput: ChronologyEvent[], minimumGapDays = 30) {
  const events = [...eventsInput].sort((left, right) => {
    const leftTime = toDate(left.eventDate).getTime();
    const rightTime = toDate(right.eventDate).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return toDate(left.createdAt).getTime() - toDate(right.createdAt).getTime();
  });

  const gaps: ChronologyGap[] = [];
  for (let index = 1; index < events.length; index += 1) {
    const prev = events[index - 1];
    const next = events[index];

    if (!prev || !next) {
      continue;
    }

    const gapMs = toDate(next.eventDate).getTime() - toDate(prev.eventDate).getTime();
    const gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));

    if (gapDays >= minimumGapDays) {
      gaps.push({
        fromEventId: prev.id,
        toEventId: next.id,
        fromDate: prev.eventDate,
        toDate: next.eventDate,
        gapDays
      });
    }
  }

  const byDate = new Map<string, ChronologyEvent[]>();
  for (const event of events) {
    const key = dateOnly(event.eventDate);
    const collection = byDate.get(key) ?? [];
    collection.push(event);
    byDate.set(key, collection);
  }

  const conflicts: ChronologyConflict[] = [];

  for (const [date, dayEvents] of byDate) {
    const tags = new Set(dayEvents.flatMap((event) => event.tags.map((tag) => tag.toLowerCase())));

    for (const [tagA, tagB] of oppositeTags) {
      if (!tags.has(tagA) || !tags.has(tagB)) {
        continue;
      }

      const eventIds = dayEvents
        .filter((event) => {
          const lowerTags = event.tags.map((tag) => tag.toLowerCase());
          return lowerTags.includes(tagA) || lowerTags.includes(tagB);
        })
        .map((event) => event.id);

      conflicts.push({
        date,
        tagA,
        tagB,
        eventIds
      });
    }
  }

  const monthly = new Map<string, ChronologyEvent[]>();
  for (const event of events) {
    const key = event.eventDate.slice(0, 7);
    const collection = monthly.get(key) ?? [];
    collection.push(event);
    monthly.set(key, collection);
  }

  return {
    events,
    gaps,
    conflicts,
    byMonth: Array.from(monthly.entries()).map(([month, monthEvents]) => ({
      month,
      events: monthEvents
    }))
  };
}
