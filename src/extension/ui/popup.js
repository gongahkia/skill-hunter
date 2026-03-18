import { MESSAGE_ACTIONS, SOURCE_LABELS } from '../../shared/core/constants.js';
import { formatDuration, formatRelativeTime, renderTagList, escapeHtml } from '../lib/formatters.js';
import { sendRuntimeMessage } from '../lib/browser-api.js';
import { DIFFICULTY_OPTIONS, TOPIC_OPTIONS, VERIFIED_SOURCE_OPTIONS } from '../lib/ui-options.js';

let countdownTimer = null;
let latestState = null;

function setMessage(message, success = false) {
    const panel = document.getElementById('messagePanel');
    if (!message) {
        panel.innerHTML = '';
        return;
    }

    panel.innerHTML = `<div class="message ${success ? 'success' : ''}">${escapeHtml(message)}</div>`;
}

function renderStatus(state) {
    const statusPanel = document.getElementById('statusPanel');
    const challenge = state.currentChallenge;

    if (state.hasActiveSession) {
        statusPanel.innerHTML = `
            <span class="status-pill success">Unlocked</span>
            <h2>The tab leash is off for now.</h2>
            <p>Your chatbot parole clock is live. Use it before Dorso starts sneering again.</p>
            <p class="countdown" id="countdownValue">${formatDuration(state.session.timeRemaining)}</p>
        `;

        if (countdownTimer) {
            window.clearInterval(countdownTimer);
        }

        countdownTimer = window.setInterval(async () => {
            latestState = latestState || state;
            if (!latestState?.session?.expiresAt) {
                return;
            }

            const remaining = Math.max(0, new Date(latestState.session.expiresAt).getTime() - Date.now());
            const countdownValue = document.getElementById('countdownValue');
            if (countdownValue) {
                countdownValue.textContent = formatDuration(remaining);
            }
        }, 1000);
        return;
    }

    if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }

    statusPanel.innerHTML = `
        <span class="status-pill">Locked</span>
        <h2>Dorso is still gatekeeping your next prompt.</h2>
        <p>${challenge ? 'You already have a challenge waiting.' : 'No challenge is cached yet. Generate one and start earning your way back in.'}</p>
    `;
}

function renderChallenge(state) {
    const panel = document.getElementById('challengePanel');
    const challenge = state.currentChallenge;

    if (!challenge) {
        panel.innerHTML = `
            <h2>No Active Challenge</h2>
            <p>Dorso has not staged the next humiliation yet.</p>
            <div class="button-row">
                <button class="button-primary" id="generateChallengeButton" type="button">Generate Challenge</button>
            </div>
        `;
        document.getElementById('generateChallengeButton').addEventListener('click', () => startChallenge(true));
        return;
    }

    panel.innerHTML = `
        <div class="section-head">
            <div>
                <h2>${escapeHtml(challenge.title)}</h2>
                <p>${escapeHtml(SOURCE_LABELS[challenge.source] || challenge.source)} • ${escapeHtml(challenge.difficulty)} • ${escapeHtml(challenge.selection_mode || 'matched')}</p>
            </div>
        </div>
        <div class="chip-row">${renderTagList(challenge.topic_tags || [])}</div>
        <div class="button-row">
            <button class="button-primary" id="openChallengeButton" type="button">Open Challenge</button>
            <button class="button-secondary" id="refreshChallengeButton" type="button">Get Another</button>
            ${state.pendingRedirectUrl ? '<button class="button-quiet" id="returnButton" type="button">Return To Blocked Tab</button>' : ''}
        </div>
    `;

    document.getElementById('openChallengeButton').addEventListener('click', async () => {
        await sendRuntimeMessage({ action: MESSAGE_ACTIONS.OPEN_CURRENT_CHALLENGE });
    });
    document.getElementById('refreshChallengeButton').addEventListener('click', () => startChallenge(true));

    if (state.pendingRedirectUrl) {
        document.getElementById('returnButton').addEventListener('click', async () => {
            await sendRuntimeMessage({ action: MESSAGE_ACTIONS.RESTORE_PENDING_TAB });
        });
    }
}

function renderPreferences(state) {
    const preferences = state.preferences || {};
    const form = document.getElementById('preferencesForm');

    const difficultyMarkup = DIFFICULTY_OPTIONS.map((option) => {
        const checked = (preferences.preferred_difficulties || []).includes(option) ? 'checked' : '';
        return `
            <label class="checkbox-card">
                <input type="checkbox" name="preferred_difficulties" value="${option}" ${checked}>
                <span>${option}</span>
            </label>
        `;
    }).join('');

    const topicMarkup = TOPIC_OPTIONS.map((option) => {
        const checked = (preferences.preferred_topics || []).includes(option) ? 'checked' : '';
        return `
            <label class="checkbox-card">
                <input type="checkbox" name="preferred_topics" value="${option}" ${checked}>
                <span>${option}</span>
            </label>
        `;
    }).join('');

    const sourceMarkup = VERIFIED_SOURCE_OPTIONS.map((option) => {
        const checked = (preferences.enabled_verified_sources || []).includes(option.id) ? 'checked' : '';
        return `
            <label class="checkbox-card">
                <input type="checkbox" name="enabled_verified_sources" value="${option.id}" ${checked}>
                <span>${option.label}</span>
            </label>
        `;
    }).join('');

    form.innerHTML = `
        <div>
            <strong>Difficulty</strong>
            <div class="checkbox-grid">${difficultyMarkup}</div>
        </div>
        <div>
            <strong>Topics</strong>
            <div class="checkbox-grid">${topicMarkup}</div>
        </div>
        <div>
            <strong>Verified Sources</strong>
            <span class="small">Codeforces becomes useful once you link a handle.</span>
            <div class="checkbox-grid">${sourceMarkup}</div>
        </div>
        <button class="button-primary" type="submit">Save Preferences</button>
    `;

    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            preferred_difficulties: formData.getAll('preferred_difficulties'),
            preferred_topics: formData.getAll('preferred_topics'),
            enabled_verified_sources: formData.getAll('enabled_verified_sources'),
        };
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_PREFERENCES,
            payload,
        });
        setMessage('Preferences saved. Dorso will bias future challenge draws accordingly.', true);
        await loadState();
    };
}

function renderIdentities(state) {
    const identities = state.identities || {};
    const form = document.getElementById('identitiesForm');

    form.innerHTML = `
        <label>
            <strong>Codeforces Handle</strong>
            <span class="small">Needed before Dorso can verify a Codeforces unlock later.</span>
            <input type="text" name="codeforces_handle" value="${escapeHtml(identities.codeforces_handle || '')}" placeholder="tourist">
        </label>
        <label>
            <strong>Codewars Username</strong>
            <span class="small">Stored now for later catalog work. It does not unlock anything yet.</span>
            <input type="text" name="codewars_username" value="${escapeHtml(identities.codewars_username || '')}" placeholder="kata-grinder">
        </label>
        <button class="button-primary" type="submit">Save Handles</button>
    `;

    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_IDENTITIES,
            payload: {
                codeforces_handle: formData.get('codeforces_handle')?.trim() || '',
                codewars_username: formData.get('codewars_username')?.trim() || '',
            },
        });
        setMessage('Handles saved. Dorso now knows where to look when external verification matters.', true);
        await loadState();
    };
}

function renderHistory(state) {
    const attemptsPanel = document.getElementById('attemptsPanel');
    const accessPanel = document.getElementById('accessPanel');
    const attempts = state.stats?.recent_attempts || [];
    const accesses = state.stats?.recent_accesses || [];

    attemptsPanel.innerHTML = attempts.length
        ? attempts.map((attempt) => `
            <div class="list-item">
                <strong>${escapeHtml(attempt.problem_title)}</strong>
                <span class="small">${escapeHtml(SOURCE_LABELS[attempt.source] || attempt.source)} • ${escapeHtml(attempt.difficulty)} • ${attempt.solved ? 'Solved' : 'Missed'}</span>
            </div>
        `).join('')
        : '<div class="list-item"><strong>No attempts yet.</strong><span class="small">That either means discipline or a brand-new install.</span></div>';

    accessPanel.innerHTML = accesses.length
        ? accesses.map((entry) => `
            <div class="list-item">
                <strong>${escapeHtml(entry.chatbot_name)}</strong>
                <span class="small">${escapeHtml(formatRelativeTime(entry.accessed_at))}</span>
            </div>
        `).join('')
        : '<div class="list-item"><strong>No chatbot access logged yet.</strong><span class="small">Dorso is either winning or nobody has started playing.</span></div>';
}

function renderMetrics(state) {
    const panel = document.getElementById('statusPanel');
    const stats = state.stats;

    if (!stats) {
        return;
    }

    panel.insertAdjacentHTML('beforeend', `
        <div class="metrics">
            <div class="metric">
                <span class="metric-label">Solves</span>
                <span class="metric-value">${stats.total_solves ?? 0}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Attempts</span>
                <span class="metric-value">${stats.total_attempts ?? 0}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Streak</span>
                <span class="metric-value">${stats.current_streak ?? 0}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Solve Rate</span>
                <span class="metric-value">${stats.solve_rate ?? 0}%</span>
            </div>
        </div>
    `);
}

async function startChallenge(force = false) {
    await sendRuntimeMessage({
        action: MESSAGE_ACTIONS.START_CHALLENGE,
        force,
    });
    setMessage('A fresh challenge is waiting. Dorso expects competence, not bargaining.', true);
    await loadState();
}

async function loadState() {
    const response = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.REQUEST_STATE });
    latestState = response.state;

    setMessage(latestState.uiMessage, latestState.hasActiveSession);
    renderStatus(latestState);
    renderMetrics(latestState);
    renderChallenge(latestState);
    renderPreferences(latestState);
    renderIdentities(latestState);
    renderHistory(latestState);
}

loadState().catch((error) => {
    setMessage(`Unable to load Dorso state: ${error.message}`);
});
