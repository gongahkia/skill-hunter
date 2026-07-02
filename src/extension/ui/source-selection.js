export const SOURCE_SELECTION_REQUIRED_MESSAGE = 'Select at least one challenge source. Bundled MCQ and drills stay available.';

export function getSourceSelection(values) {
    const enabledSources = Array.from(values || [], (value) => String(value)).filter(Boolean);

    return {
        enabledSources,
        hasSelection: enabledSources.length > 0,
        message: enabledSources.length > 0 ? '' : SOURCE_SELECTION_REQUIRED_MESSAGE,
    };
}
