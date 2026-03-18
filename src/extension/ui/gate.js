import { MESSAGE_ACTIONS, SOURCE_LABELS } from '../../shared/core/constants.js';
import { escapeHtml, formatDuration, renderTagList } from '../lib/formatters.js';
import { sendRuntimeMessage } from '../lib/browser-api.js';

function setGateMessage(message, success = false) {
    const panel = document.getElementById('gateMessage');
    if (!message) {
        panel.innerHTML = '';
        return;
    }

    panel.innerHTML = `<div class="message ${success ? 'success' : ''}">${escapeHtml(message)}</div>`;
}

function renderGateStatus(state) {
    const panel = document.getElementById('gateStatusPanel');

    if (state.hasActiveSession) {
        panel.innerHTML = `
            <span class="status-pill success">Unlocked</span>
            <h2>You paid the toll.</h2>
            <p>Dorso has already granted a fifteen-minute truce.</p>
            <p class="countdown">${formatDuration(state.session.timeRemaining)}</p>
        `;
        return;
    }

    panel.innerHTML = `
        <span class="status-pill">Locked</span>
        <h2>This tab stays hostage until a problem is solved.</h2>
        <p>${state.pendingRedirectUrl ? `Original target: ${escapeHtml(state.pendingRedirectUrl)}` : 'No blocked target is cached right now.'}</p>
    `;
}

function renderGateControls(state) {
    const panel = document.getElementById('gateControlPanel');
    const challenge = state.currentChallenge;

    panel.innerHTML = `
        <h2>Control Panel</h2>
        <p>${challenge ? `Current source: ${escapeHtml(SOURCE_LABELS[challenge.source] || challenge.source)}.` : 'No challenge is loaded yet.'}</p>
        <div class="button-row">
            <button class="button-primary" id="openChallengeButton" type="button">${challenge ? 'Open Challenge' : 'Fetch Challenge'}</button>
            <button class="button-secondary" id="refreshChallengeButton" type="button">Swap Challenge</button>
            ${state.pendingRedirectUrl ? '<button class="button-quiet" id="restoreTabButton" type="button">Restore AI Tab</button>' : ''}
        </div>
    `;

    document.getElementById('openChallengeButton').addEventListener('click', async () => {
        if (!challenge) {
            await sendRuntimeMessage({ action: MESSAGE_ACTIONS.START_CHALLENGE, force: true });
        }
        await sendRuntimeMessage({ action: MESSAGE_ACTIONS.OPEN_CURRENT_CHALLENGE });
    });

    document.getElementById('refreshChallengeButton').addEventListener('click', async () => {
        await sendRuntimeMessage({ action: MESSAGE_ACTIONS.START_CHALLENGE, force: true });
        await loadState();
    });

    if (state.pendingRedirectUrl) {
        document.getElementById('restoreTabButton').addEventListener('click', async () => {
            await sendRuntimeMessage({ action: MESSAGE_ACTIONS.RESTORE_PENDING_TAB });
        });
    }
}

function renderChallenge(state) {
    const challenge = state.currentChallenge;
    const meta = document.getElementById('challengeMeta');
    const tagPanel = document.getElementById('challengeTags');
    const body = document.getElementById('challengeBody');

    if (!challenge) {
        meta.textContent = 'No challenge is currently staged.';
        tagPanel.innerHTML = '';
        body.innerHTML = '<p>Dorso has nothing queued yet. Generate a challenge first.</p>';
        return;
    }

    meta.textContent = `${SOURCE_LABELS[challenge.source] || challenge.source} • ${challenge.difficulty} • ${challenge.selection_mode}`;
    tagPanel.innerHTML = renderTagList(challenge.topic_tags || []);
    body.innerHTML = challenge.content || '<p>No challenge body was returned.</p>';
}

async function loadState() {
    const response = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.REQUEST_STATE });
    let state = response.state;

    if (!state.currentChallenge && !state.hasActiveSession) {
        await sendRuntimeMessage({ action: MESSAGE_ACTIONS.START_CHALLENGE, force: false });
        state = (await sendRuntimeMessage({ action: MESSAGE_ACTIONS.REQUEST_STATE })).state;
    }

    setGateMessage(state.uiMessage, state.hasActiveSession);
    renderGateStatus(state);
    renderGateControls(state);
    renderChallenge(state);
}

loadState().catch((error) => {
    setGateMessage(`Unable to load Dorso gate state: ${error.message}`);
});
