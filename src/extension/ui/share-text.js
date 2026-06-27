export const SOLVE_SHARE_TEXT = {
    title: 'Dorso solve receipt',
    imageName: 'dorso-solve-receipt.png',
};

export function createSolveShareText(receipt = {}) {
    const problemTitle = receipt.problemTitle || 'a coding challenge';
    const sourceLabel = receipt.sourceLabel || 'Dorso';
    const currentRun = Math.max(0, Math.trunc(Number(receipt.currentRun || 0)));
    return `Dorso unlocked after solving ${problemTitle} on ${sourceLabel}. Current run: ${currentRun}.`;
}
