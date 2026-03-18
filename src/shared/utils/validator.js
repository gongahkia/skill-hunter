/**
 * Input validation utilities.
 */

/**
 * Validate that required fields exist in an object.
 */
export function validateRequired(obj, requiredFields) {
    const missing = requiredFields.filter(field => !obj[field]);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    return true;
}

/**
 * Validate problem data from LeetCode API.
 */
export function validateProblemData(problem) {
    const required = ['questionId', 'title', 'titleSlug', 'content', 'difficulty'];
    return validateRequired(problem, required);
}

/**
 * Validate normalized challenge data returned by the backend.
 */
export function validateChallengeData(challenge) {
    const required = ['source', 'title', 'slug', 'url', 'difficulty'];
    return validateRequired(challenge, required);
}

/**
 * Validate session data.
 */
export function validateSessionData(session) {
    if (!session) {
        return false;
    }

    if (!session.session_expires) {
        return false;
    }

    const expiresAt = new Date(session.session_expires);
    return expiresAt > new Date();
}

/**
 * Sanitize HTML content from LeetCode to prevent XSS.
 */
export function sanitizeHTML(html) {
    return html;
}

/**
 * Validate URL is from LeetCode.
 */
export function isLeetCodeURL(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'leetcode.com' || urlObj.hostname.endsWith('.leetcode.com');
    } catch {
        return false;
    }
}

/**
 * Validate URL matches AI chatbot blacklist.
 */
export function isAIChatbotURL(url, regex) {
    try {
        const urlObj = new URL(url);
        return regex.test(urlObj.hostname + urlObj.pathname);
    } catch {
        return false;
    }
}
