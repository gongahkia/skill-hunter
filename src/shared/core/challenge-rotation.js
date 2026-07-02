function getProviderRotationOrder(enabledSources, randomValue = Math.random()) {
    const sources = [...new Set(Array.isArray(enabledSources) ? enabledSources : [])];
    if (sources.length === 0) {
        return [];
    }

    const startIndex = Math.min(sources.length - 1, Math.floor(randomValue * sources.length));
    return [
        ...sources.slice(startIndex),
        ...sources.slice(0, startIndex),
    ];
}

async function getChallengeFromEnabledProviders({
    providers,
    enabledSources,
    recentSlugs = [],
    difficulty,
    randomValue = Math.random(),
} = {}) {
    const errors = [];

    for (const sourceId of getProviderRotationOrder(enabledSources, randomValue)) {
        const provider = providers?.[sourceId];
        if (!provider?.getChallenge) {
            continue;
        }

        try {
            return await provider.getChallenge({ recentSlugs, difficulty });
        } catch (error) {
            errors.push(`${sourceId}: ${error.message || String(error)}`);
        }
    }

    throw new Error(`Unable to load a challenge from enabled sources${errors.length ? ` (${errors.join('; ')})` : ''}.`);
}

function recordRecentChallenge(recentSlugs, challenge, { timestamp = Date.now(), windowSize = 5 } = {}) {
    if (!challenge?.source || !challenge?.slug) {
        return Array.isArray(recentSlugs) ? recentSlugs.slice(0, windowSize) : [];
    }

    return [
        {
            source: challenge.source,
            slug: challenge.slug,
            timestamp,
        },
        ...(Array.isArray(recentSlugs) ? recentSlugs : []).filter((entry) => {
            return entry?.source !== challenge.source || entry?.slug !== challenge.slug;
        }),
    ].slice(0, windowSize);
}

export {
    getChallengeFromEnabledProviders,
    getProviderRotationOrder,
    recordRecentChallenge,
};
