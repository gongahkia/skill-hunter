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
    normalizedMedianTimeToSolveTrend = 1,
    sourceDiversityRatio = 0,
    bypassesThisWeek = 0,
} = {}) {
    const safeSolves = Math.max(0, finiteNumber(solvesInLast7d, 0));
    const safeTarget = Math.max(1, finiteNumber(target7dSolves, 7));
    const solveRatio = Math.min(1, safeSolves / safeTarget);
    const solveTimeTrend = clamp(finiteNumber(normalizedMedianTimeToSolveTrend, 1), 0, 1);
    const diversityRatio = clamp(finiteNumber(sourceDiversityRatio, 0), 0, 1);
    const bypassPenalty = Math.max(0, Math.trunc(finiteNumber(bypassesThisWeek, 0))) * 5;

    const score = (
        (0.5 * solveRatio)
        + (0.3 * (1 - solveTimeTrend))
        + (0.2 * diversityRatio)
    ) * 100;

    return Math.round(clamp(score - bypassPenalty, 0, 100));
}
