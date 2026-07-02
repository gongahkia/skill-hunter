# Cognitive Index

Dorso's Atrophy Score is exposed in-product as `Cognitive Index`.

Range: `0-100`.

Framing: lower score means more atrophied.

Current formula:

```text
solveRatio = min(1, solvesInLast7d / target7dSolves)
timeRatio = clamp(averageTimeToSolveMs / targetTimeToSolveMs, 0, 1)
timeComponent = 1 - timeRatio
failComponent = 1 - clamp(failRate, 0, 1)
streakRatio = min(1, currentRun / targetRunLength)
diversityRatio = clamp(sourceDiversityRatio, 0, 1)
bypassPenalty = bypassesThisWeek * 5

score = (
  0.30 * solveRatio +
  0.20 * timeComponent +
  0.20 * failComponent +
  0.20 * streakRatio +
  0.10 * diversityRatio
) * 100 - bypassPenalty

Cognitive Index = round(clamp(score, 0, 100))
```

Inputs:

- `solvesInLast7d`: number of successful solves in the last 7 days.
- `target7dSolves`: weekly solve target; default `7`.
- `averageTimeToSolveMs`: average solve time for the current scoring window.
- `targetTimeToSolveMs`: solve-time target; default `300000` ms.
- `failRate`: failed answer attempts divided by total answer attempts for the scoring window.
- `currentRun`: current streak length.
- `targetRunLength`: streak length target; default `7`.
- `normalizedMedianTimeToSolveTrend`: fallback time input when `averageTimeToSolveMs` is unavailable; `0` means improving or fast, `1` means slowest accepted trend.
- `sourceDiversityRatio`: enabled or used challenge-source diversity, normalized to `0-1`.
- `bypassesThisWeek`: emergency bypass count in the current week.

Calibration notes:

- Increase the solve weight if consistency matters more than speed.
- Increase the time weight if fast recall is the launch focus.
- Increase the diversity weight if one-source grinding makes the badge too easy.
- Keep bypass penalty simple so users can reason about the impact.
- Recalibrate after one week of author usage before treating the values as stable.

Export behavior:

- Local badge export renders a client-side SVG/PNG and does not require Dorso infrastructure.
- Hosted README embeds are optional and require a signing secret plus the Cloudflare Worker.
