function normalizeNumericAnswer(value) {
    const text = String(value ?? '').trim();
    if (!/^-?[\d\s,_]+$/.test(text)) {
        return text;
    }

    return text.replace(/[\s,_]/g, '');
}

export { normalizeNumericAnswer };
