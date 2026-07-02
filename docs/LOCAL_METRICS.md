# Local Metrics

Dorso stores streaks and solve metrics in `chrome.storage.local`. No account or backend is required.

## Storage Keys

`streakState`:

```json
{
  "currentRun": 3,
  "longestRun": 8,
  "graceDaysRemaining": 1,
  "pausedUntil": null,
  "lastSolveDate": "2026-07-02"
}
```

`solveMetrics`:

```json
{
  "weekKey": "2026-27",
  "solvesThisWeek": 4,
  "attemptsThisWeek": 6,
  "failuresThisWeek": 2,
  "totalSolveTimeMs": 720000,
  "averageTimeToSolveMs": 180000,
  "failRate": 0.3333333333333333
}
```

`BYPASSES_USED_THIS_WEEK` and `BYPASS_WEEK_START` track emergency bypass attempts for the same local dashboard and score consumers.

## Reset Rules

- `streakState` rolls over by calendar day and resets weekly grace days when the ISO week changes.
- `solveMetrics` resets when the ISO week changes.
- `averageTimeToSolveMs` is derived from `totalSolveTimeMs / solvesThisWeek`.
- `failRate` is derived from `failuresThisWeek / attemptsThisWeek`.

## Consumers

- Solve receipts read `streakState.currentRun`.
- The popup dashboard shows current run, longest run, solves/week, average solve time, and fail rate.
- Cognitive Index reads solves/week, average solve time, fail rate, current run, source diversity, and bypasses/week.
