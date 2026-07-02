export const COGNITIVE_INDEX_LABEL = 'Cognitive Index';

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

export function computeCognitiveIndex({
    solvesInLast7d = 0,
    target7dSolves = 7,
    currentRun = 0,
    targetRunLength = 7,
    averageTimeToSolveMs,
    targetTimeToSolveMs = 5 * 60 * 1000,
    failRate = 0,
    normalizedMedianTimeToSolveTrend = 1,
    sourceDiversityRatio = 0,
    bypassesThisWeek = 0,
} = {}) {
    const safeSolves = Math.max(0, finiteNumber(solvesInLast7d, 0));
    const safeTarget = Math.max(1, finiteNumber(target7dSolves, 7));
    const safeRun = Math.max(0, finiteNumber(currentRun, 0));
    const safeRunTarget = Math.max(1, finiteNumber(targetRunLength, 7));
    const solveRatio = Math.min(1, safeSolves / safeTarget);
    const solveTimeTrend = Number.isFinite(averageTimeToSolveMs)
        ? clamp(
            finiteNumber(averageTimeToSolveMs, 0)
                / Math.max(1, finiteNumber(targetTimeToSolveMs, 5 * 60 * 1000)),
            0,
            1,
        )
        : clamp(finiteNumber(normalizedMedianTimeToSolveTrend, 1), 0, 1);
    const failRatio = clamp(finiteNumber(failRate, 0), 0, 1);
    const streakRatio = Math.min(1, safeRun / safeRunTarget);
    const diversityRatio = clamp(finiteNumber(sourceDiversityRatio, 0), 0, 1);
    const bypassPenalty = Math.max(0, Math.trunc(finiteNumber(bypassesThisWeek, 0))) * 5;

    const score = (
        (0.3 * solveRatio)
        + (0.2 * (1 - solveTimeTrend))
        + (0.2 * (1 - failRatio))
        + (0.2 * streakRatio)
        + (0.1 * diversityRatio)
    ) * 100;

    return Math.round(clamp(score - bypassPenalty, 0, 100));
}
