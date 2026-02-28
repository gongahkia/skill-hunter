import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChronology } from "./engine.js";

describe("sun-and-moon chronology engine", () => {
  it("sorts events and detects large gaps", () => {
    const chronology = buildChronology([
      {
        id: "2",
        caseId: "c1",
        eventType: "fact",
        title: "Event B",
        description: "b",
        eventDate: "2026-04-15T00:00:00.000Z",
        sourceRef: "doc-b",
        citation: null,
        tags: [],
        createdAt: "2026-04-15T00:00:00.000Z"
      },
      {
        id: "1",
        caseId: "c1",
        eventType: "fact",
        title: "Event A",
        description: "a",
        eventDate: "2026-01-01T00:00:00.000Z",
        sourceRef: "doc-a",
        citation: null,
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    assert.equal(chronology.events[0]?.id, "1");
    assert.equal((chronology.gaps[0]?.gapDays ?? 0) > 30, true);
  });

  it("detects contradiction tags on same date", () => {
    const chronology = buildChronology([
      {
        id: "1",
        caseId: "c1",
        eventType: "fact",
        title: "Termination claim",
        description: "x",
        eventDate: "2026-02-01T00:00:00.000Z",
        sourceRef: "a",
        citation: null,
        tags: ["termination"],
        createdAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "2",
        caseId: "c1",
        eventType: "fact",
        title: "Renewal claim",
        description: "y",
        eventDate: "2026-02-01T12:00:00.000Z",
        sourceRef: "b",
        citation: null,
        tags: ["renewal"],
        createdAt: "2026-02-01T12:00:00.000Z"
      }
    ]);

    assert.equal(chronology.conflicts.length > 0, true);
  });
});
