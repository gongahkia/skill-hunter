import {
    MESSAGE_ACTIONS,
    SESSION_DURATION_MINUTE_OPTIONS,
    SOURCE_LABELS,
    STORAGE_KEYS,
} from '../../shared/core/constants.js';
import { formatDuration } from '../lib/formatters.js';
import {
    getDigestEntries,
    renderDigestMarkdown,
    renderDigestSvg,
} from '../lib/digest-svg.js';
import {
    getStorageValues,
    sendRuntimeMessage,
    setStorageValues,
} from '../lib/browser-api.js';

let countdownTimer = null;
let latestState = null;
let latestWhatIAsked = [];
const redactedWhatIAskedTimestamps = new Set();

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

async function getWhatIAskedEntries() {
    const result = await getStorageValues([STORAGE_KEYS.WHAT_I_ASKED]);
    return Array.isArray(result[STORAGE_KEYS.WHAT_I_ASKED])
        ? result[STORAGE_KEYS.WHAT_I_ASKED]
        : [];
}

async function deleteWhatIAskedEntry(timestamp) {
    const entries = await getWhatIAskedEntries();
    const nextEntries = entries.filter((entry) => entry.timestamp !== timestamp);
    await setStorageValues({ [STORAGE_KEYS.WHAT_I_ASKED]: nextEntries });
    setMessage('Entry deleted.', true);
    await loadState();
}

function getIncludedDigestEntries(entries) {
    return getDigestEntries(entries).filter((entry) => !redactedWhatIAskedTimestamps.has(entry.timestamp));
}

function downloadTextFile(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

async function downloadDigestPng(svg) {
    const image = new Image();
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dorso-weekly-digest.png';
    link.click();
    URL.revokeObjectURL(url);
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
    const durationSelect = createElement('select', { id: 'sessionDurationSelect' });
    SESSION_DURATION_MINUTE_OPTIONS.forEach((minutes) => {
        const option = createElement('option', { text: `${minutes} min` });
        option.value = String(minutes);
        durationSelect.append(option);
    });
    durationSelect.value = String(state.sessionDurationMinutes || 15);
    durationSelect.addEventListener('change', async () => {
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                sessionDurationMsPref: Number(durationSelect.value) * 60 * 1000,
            },
        });
        setMessage('Session length saved.', true);
        await loadState();
    });

    const durationLabel = createElement('label', { className: 'field-label' });
    durationLabel.append(
        createElement('span', { text: 'Session length' }),
        durationSelect,
    );

    panel.append(
        createSectionHead(
            'Controls',
            'Pause protection or clear status copy without changing the selected site list.',
        ),
        createElement('div', { className: 'field-grid' }),
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
    panel.querySelector('.field-grid').append(durationLabel);
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

function renderDisclosure(entries = []) {
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

    const askedList = createElement('div', { className: 'list' });
    entries.slice().reverse().forEach((entry) => {
        const row = createElement('div', { className: 'list-item list-item-actions' });
        const textBlock = createElement('div');
        const includeLabel = createElement('label', { className: 'inline-check' });
        const includeCheckbox = createElement('input');
        includeCheckbox.type = 'checkbox';
        includeCheckbox.checked = !redactedWhatIAskedTimestamps.has(entry.timestamp);
        includeCheckbox.addEventListener('change', () => {
            if (includeCheckbox.checked) {
                redactedWhatIAskedTimestamps.delete(entry.timestamp);
                return;
            }

            redactedWhatIAskedTimestamps.add(entry.timestamp);
        });
        includeLabel.append(includeCheckbox, createElement('span', { text: 'Include' }));
        textBlock.append(
            createElement('strong', { text: entry.target || 'unknown target' }),
            createElement('span', {
                className: 'small',
                text: `${new Date(entry.timestamp).toLocaleString()} - ${entry.text}`,
            }),
        );
        row.append(
            textBlock,
            includeLabel,
            createButton({
                label: 'Delete',
                className: 'button-secondary',
                onClick: () => deleteWhatIAskedEntry(entry.timestamp),
            }),
        );
        askedList.append(row);
    });

    panel.append(
        createSectionHead('What I Asked', 'Saved locally on this device.'),
        entries.length ? askedList : createElement('p', { text: 'No saved prompts.' }),
    );

    panel.append(
        createSectionHead('Weekly Digest', 'Export saved prompts from the last 7 days.'),
        createButtonRow([
            createButton({
                label: 'Download SVG',
                className: 'button-primary',
                onClick: () => {
                    const digestSvg = renderDigestSvg({ entries: getIncludedDigestEntries(entries) });
                    downloadTextFile('dorso-weekly-digest.svg', digestSvg, 'image/svg+xml');
                },
            }),
            createButton({
                label: 'Download PNG',
                className: 'button-secondary',
                onClick: async () => {
                    const digestSvg = renderDigestSvg({ entries: getIncludedDigestEntries(entries) });
                    await downloadDigestPng(digestSvg);
                },
            }),
            createButton({
                label: 'Copy Markdown',
                className: 'button-secondary',
                onClick: async () => {
                    const digestEntries = getIncludedDigestEntries(entries);
                    await navigator.clipboard.writeText(renderDigestMarkdown(digestEntries));
                    setMessage('Digest markdown copied.', true);
                },
            }),
        ]),
    );
}

async function startChallenge(force = false) {
    await sendRuntimeMessage({
        action: MESSAGE_ACTIONS.START_CHALLENGE,
        force,
        targetUrl: latestState?.supportedTargets?.[0]?.matches?.[0]?.replace('*', ''),
    });
    await loadState();
}

async function loadState() {
    const response = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.REQUEST_STATE });
    latestState = response.state;
    latestWhatIAsked = await getWhatIAskedEntries();

    setMessage(latestState.uiMessage || latestState.leetcodeDetectionWarning, latestState.hasActiveSession && !latestState.leetcodeDetectionWarning);
    renderStatus(latestState);
    renderChallenge(latestState);
    renderControls(latestState);
    renderSupportedSites(latestState);
    renderDisclosure(latestWhatIAsked);
}

loadState().catch((error) => {
    setMessage(`Unable to load Dorso state: ${error.message}`);
});
