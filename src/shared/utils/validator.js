/**
 * Input validation utilities.
 */

import { getChatbotTargetByUrl } from '../core/constants.js';

export function validateRequired(obj, requiredFields) {
    const missing = requiredFields.filter((field) => !obj[field]);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

export function validateChallengeData(challenge) {
    const required = ['source', 'title', 'slug', 'url', 'difficulty'];
    return validateRequired(challenge, required);
}

export function validateSessionData(session) {
    if (!session?.session_expires) {
        return false;
    }

    const expiresAt = new Date(session.session_expires);
    return expiresAt > new Date();
}

export function sanitizeHTML(html) {
    return String(html)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function isLeetCodeURL(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'leetcode.com' || urlObj.hostname.endsWith('.leetcode.com');
    } catch {
        return false;
    }
}

export function isAIChatbotURL(url) {
    return Boolean(getChatbotTargetByUrl(url));
}
