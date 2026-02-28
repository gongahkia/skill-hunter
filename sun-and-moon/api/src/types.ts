export type ChronologyCase = {
  id: string;
  name: string;
  jurisdiction: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
};

export type ChronologyEvent = {
  id: string;
  caseId: string;
  eventType: "fact" | "evidence" | "filing" | "communication" | "hearing";
  title: string;
  description: string;
  eventDate: string;
  sourceRef: string;
  citation: string | null;
  tags: string[];
  createdAt: string;
};

export type ChronologyStore = {
  cases: ChronologyCase[];
  events: ChronologyEvent[];
};

export type ChronologyGap = {
  fromEventId: string;
  toEventId: string;
  fromDate: string;
  toDate: string;
  gapDays: number;
};

export type ChronologyConflict = {
  date: string;
  tagA: string;
  tagB: string;
  eventIds: string[];
};
