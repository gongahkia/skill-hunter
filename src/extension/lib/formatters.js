export function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatRelativeTime(value) {
    if (!value) {
        return 'Never';
    }

    return new Date(value).toLocaleString();
}

export function renderTagList(tags = []) {
    if (!tags.length) {
        return '<span class="chip chip-muted">No tags</span>';
    }

    return tags
        .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
        .join('');
}

export function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

