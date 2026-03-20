import {
    MESSAGE_ACTIONS,
    SOURCE_LABELS,
} from '../../shared/core/constants.js';
import { formatDuration } from '../lib/formatters.js';
import { sendRuntimeMessage } from '../lib/browser-api.js';

let countdownTimer = null;
let latestState = null;

function clearTimers() {
    if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function resetPanel(panel) {
    panel.replaceChildren();
}

function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);

    if (options.className) {
        element.className = options.className;
    }

    if (options.id) {
        element.id = options.id;
    }

    if (options.type) {
        element.type = options.type;
    }

    if (options.text) {
        element.textContent = options.text;
    }

    return element;
}

function createButton({ label, className, id, onClick, type = 'button' }) {
    const button = createElement('button', {
        className,
        id,
        text: label,
        type,
    });
    button.addEventListener('click', onClick);
    return button;
}

function createSectionHead(title, copy) {
    const head = createElement('div', { className: 'section-head' });
    const copyBlock = document.createElement('div');
    copyBlock.append(
        createElement('h2', { text: title }),
        createElement('p', { text: copy }),
    );
    head.append(copyBlock);
    return head;
}

function createButtonRow(buttons) {
    const row = createElement('div', { className: 'button-row' });
    buttons.forEach((button) => row.append(button));
    return row;
}

function createChipRow(tags = []) {
    const chipRow = createElement('div', { className: 'chip-row' });
    if (!tags.length) {
        chipRow.append(createElement('span', {
            className: 'chip chip-muted',
            text: 'No tags',
        }));
        return chipRow;
    }

    tags.forEach((tag) => {
        chipRow.append(createElement('span', {
            className: 'chip',
            text: tag,
        }));
    });
    return chipRow;
}

function setMessage(message, success = false) {
    const panel = document.getElementById('messagePanel');
    resetPanel(panel);

    if (!message) {
        return;
    }

    panel.append(createElement('div', {
        className: `message ${success ? 'success' : ''}`.trim(),
        text: message,
    }));
}

function renderStatus(state) {
    const panel = document.getElementById('statusPanel');
    resetPanel(panel);

    if (state.hasActiveSession) {
        const countdownValue = createElement('p', {
            className: 'countdown',
            id: 'countdownValue',
            text: formatDuration(state.session.timeRemaining),
        });

        panel.append(
            createElement('span', {
                className: 'status-pill success',
                text: 'Unlocked',
            }),
            createElement('h2', { text: 'Dorso is standing down.' }),
            createElement('p', { text: 'You can use protected chatbot sites until the timer expires.' }),
            countdownValue,
        );

        clearTimers();
        countdownTimer = window.setInterval(() => {
            if (!latestState?.session?.expiresAt) {
                return;
            }

            const remaining = Math.max(0, new Date(latestState.session.expiresAt).getTime() - Date.now());
            countdownValue.textContent = formatDuration(remaining);

            if (remaining === 0) {
                clearTimers();
                loadState().catch((error) => {
                    setMessage(`Unable to refresh Dorso state: ${error.message}`);
                });
            }
        }, 1000);
        return;
    }

    clearTimers();
    panel.append(
        createElement('span', {
            className: 'status-pill',
            text: state.isPaused ? 'Paused' : 'Protecting',
        }),
        createElement('h2', {
            text: state.isPaused ? 'Dorso is paused.' : 'Dorso is protecting selected sites.',
        }),
        createElement('p', {
            text: state.isPaused
                ? 'Protected chatbot sites are temporarily open until you resume Dorso.'
                : 'Visit a selected chatbot site and Dorso will require an accepted LeetCode submission before the page becomes usable.',
        }),
    );
}

function renderChallenge(state) {
    const panel = document.getElementById('challengePanel');
    const challenge = state.currentChallenge;
    resetPanel(panel);

    if (!challenge) {
        panel.append(
            createElement('h2', { text: 'No Active Challenge' }),
            createElement('p', {
                text: 'Dorso will assign one automatically when you visit a protected chatbot site, or you can stage one now.',
            }),
            createButtonRow([
                createButton({
                    label: 'Stage Challenge',
                    className: 'button-primary',
                    id: 'generateChallengeButton',
                    onClick: () => startChallenge(true),
                }),
            ]),
        );
        return;
    }

    panel.append(
        createSectionHead(
            challenge.title,
            `${SOURCE_LABELS[challenge.source] || challenge.source} • ${challenge.difficulty} • ${challenge.selection_mode}`,
        ),
        createElement('p', { text: challenge.guidance }),
        createChipRow(challenge.topic_tags || []),
        createButtonRow([
            createButton({
                label: 'Open On LeetCode',
                className: 'button-primary',
                id: 'openChallengeButton',
                onClick: () => {
                    window.open(challenge.url, '_blank', 'noopener,noreferrer');
                },
            }),
            createButton({
                label: 'Get Another',
                className: 'button-secondary',
                id: 'refreshChallengeButton',
                onClick: () => startChallenge(true),
            }),
        ]),
    );
}

function renderControls(state) {
    const panel = document.getElementById('controlPanel');
    resetPanel(panel);

    panel.append(
        createSectionHead(
            'Controls',
            'Pause protection or clear status copy without changing the selected site list.',
        ),
        createButtonRow([
            createButton({
                label: state.isPaused ? 'Resume Dorso' : 'Pause Dorso',
                className: 'button-primary',
                id: 'pauseButton',
                onClick: async () => {
                    await sendRuntimeMessage({
                        action: MESSAGE_ACTIONS.SET_PAUSED,
                        isPaused: !state.isPaused,
                    });
                    await loadState();
                },
            }),
            createButton({
                label: 'Clear Message',
                className: 'button-secondary',
                id: 'dismissMessageButton',
                onClick: async () => {
                    await sendRuntimeMessage({ action: MESSAGE_ACTIONS.CLEAR_UI_MESSAGE });
                    await loadState();
                },
            }),
        ]),
    );
}

function renderSupportedSites(state) {
    const form = document.getElementById('sitesForm');
    const enabledTargetIds = new Set(state.enabledTargetIds || []);
    resetPanel(form);

    const checkboxGrid = createElement('div', { className: 'checkbox-grid' });
    state.supportedTargets.forEach((target) => {
        const label = createElement('label', { className: 'checkbox-card' });
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'enabledTargetIds';
        checkbox.value = target.id;
        checkbox.checked = enabledTargetIds.has(target.id);
        label.append(checkbox, createElement('span', { text: target.label }));
        checkboxGrid.append(label);
    });

    form.append(
        checkboxGrid,
        createButton({
            label: 'Save Site List',
            className: 'button-primary',
            type: 'submit',
            onClick: () => {},
        }),
    );

    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const enabledTargetIdsValue = formData.getAll('enabledTargetIds');

        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                enabledTargetIds: enabledTargetIdsValue,
            },
        });
        setMessage('Supported site list saved.', true);
        await loadState();
    };
}

function renderDisclosure() {
    const panel = document.getElementById('disclosurePanel');
    resetPanel(panel);

    const list = createElement('div', { className: 'list' });
    [
        {
            title: 'No backend sync',
            copy: 'This build does not send chatbot URLs, handles, or install identifiers to a remote server.',
        },
        {
            title: 'Selected-site only',
            copy: 'Dorso only acts on the supported chatbot domains you keep enabled in the list above.',
        },
        {
            title: 'Official problem pages',
            copy: 'Dorso links to LeetCode directly instead of rehosting third-party problem statements inside the extension.',
        },
    ].forEach((item) => {
        const row = createElement('div', { className: 'list-item' });
        row.append(
            createElement('strong', { text: item.title }),
            createElement('span', { className: 'small', text: item.copy }),
        );
        list.append(row);
    });

    panel.append(
        createSectionHead('Public Store Build', 'This release keeps the review surface small and local.'),
        list,
    );
}

async function startChallenge(force = false) {
    await sendRuntimeMessage({
        action: MESSAGE_ACTIONS.START_CHALLENGE,
        force,
    });
    await loadState();
}

async function loadState() {
    const response = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.REQUEST_STATE });
    latestState = response.state;

    setMessage(latestState.uiMessage, latestState.hasActiveSession);
    renderStatus(latestState);
    renderChallenge(latestState);
    renderControls(latestState);
    renderSupportedSites(latestState);
    renderDisclosure();
}

loadState().catch((error) => {
    setMessage(`Unable to load Dorso state: ${error.message}`);
});
