import {
    MESSAGE_ACTIONS,
    SESSION_DURATION_MINUTE_OPTIONS,
    SOURCE_LABELS,
    STORAGE_KEYS,
} from '../../shared/core/constants.js';
import { computeCognitiveIndex } from '../../shared/core/atrophy.js';
import { AI_FAST_DURATION_HOURS } from '../../shared/core/ai-fast.js';
import { EMERGENCY_BYPASS_OPTIONS } from '../../shared/core/emergency-bypass.js';
import {
    DEFAULT_TARGET_RULE,
    TARGET_RULE_DIFFICULTIES,
    TARGET_RULE_SCHEDULES,
    getTargetOrigin,
    normalizeTargetRule,
} from '../../shared/core/target-rules.js';
import { DEFAULT_CLI_STATUS_EXPORT_PATH } from '../../shared/core/cli-status.js';
import { formatDuration } from '../lib/formatters.js';
import {
    getDigestEntries,
    renderDigestMarkdown,
    renderDigestSvg,
} from '../lib/digest-svg.js';
import { renderBadgeSvg } from '../lib/badge-svg.js';
import { renderReceiptSvg } from '../lib/receipt-svg.js';
import {
    createBadgeEmbeds,
    createLeaderboardSubmission,
} from '../lib/badge-url.js';
import {
    SOLVE_SHARE_TEXT,
    createSolveShareText,
} from './share-text.js';
import { getSourceSelection } from './source-selection.js';
import validateDashboardState from '../lib/dashboard-state-validator.js';
import {
    clearStorage,
    getStorageValues,
    requestOptionalHostPermission,
    sendRuntimeMessage,
    setStorageValues,
} from '../lib/browser-api.js';

let countdownTimer = null;
let latestState = null;
let latestWhatIAsked = [];
const redactedWhatIAskedTimestamps = new Set();
const AOC_ORIGIN = 'https://adventofcode.com';
const mainPanelIds = [
    'statusPanel',
    'challengePanel',
    'controlPanel',
    'fastPanel',
    'cliPanel',
    'badgePanel',
    'sourcesPanel',
    'sitesPanel',
    'rulesPanel',
    'disclosurePanel',
];
const scheduleLabels = {
    always: 'Always',
    weekdays: 'Weekdays',
    weekends: 'Weekends',
    custom: 'Custom',
};
const difficultyLabels = {
    default: 'Default',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
};

function clearTimers() {
    if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function resetPanel(panel) {
    panel.replaceChildren();
}

function setMainPanelsHidden(hidden) {
    mainPanelIds.forEach((panelId) => {
        document.getElementById(panelId).hidden = hidden;
    });
    document.getElementById('sharePanel').hidden = true;
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

function createSelect(name, value, options, labels) {
    const select = createElement('select');
    select.name = name;
    options.forEach((optionValue) => {
        const option = createElement('option', { text: labels[optionValue] || optionValue });
        option.value = optionValue;
        select.append(option);
    });
    select.value = value;
    return select;
}

function createSnippetField(label, value) {
    const wrapper = createElement('label', { className: 'snippet-field' });
    const input = createElement('input', { type: 'text' });
    input.value = value;
    input.readOnly = true;
    wrapper.append(
        createElement('span', { text: label }),
        input,
    );
    return wrapper;
}

function formatAocHashText(answerHashes = {}) {
    return Object.entries(answerHashes)
        .sort(([leftSlug], [rightSlug]) => leftSlug.localeCompare(rightSlug))
        .map(([slug, hash]) => `${slug} ${hash}`)
        .join('\n');
}

function parseAocHashText(value) {
    const entries = String(value || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const answerHashes = {};

    entries.forEach((line) => {
        const match = /^(aoc-\d{4}-\d{2}-part-[12])(?:\s+|\s*[:=,]\s*)([a-f0-9]{64})$/i.exec(line);
        if (!match) {
            throw new Error(`Invalid Advent of Code hash line: ${line}`);
        }

        answerHashes[match[1].toLowerCase()] = match[2].toLowerCase();
    });

    return answerHashes;
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

async function loadSvgImage(svg) {
    const image = new Image();
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
    });
    return image;
}

async function rasterizeSvgToPng(svg) {
    const image = await loadSvgImage(svg);

    if (globalThis.OffscreenCanvas) {
        const canvas = new OffscreenCanvas(800, 400);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return canvas.convertToBlob({ type: 'image/png' });
    }

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
        throw new Error('PNG export failed.');
    }
    return blob;
}

async function downloadDigestPng(svg) {
    await downloadPngFile('dorso-weekly-digest.png', svg);
}

async function downloadBadgePng(svg) {
    await downloadPngFile('dorso-cognitive-index.png', svg);
}

async function downloadPngFile(filename, svg) {
    const blob = await rasterizeSvgToPng(svg);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
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

function createRunMetrics(state) {
    const tooltip = `${state.graceDaysRemaining ?? 0} grace day(s) remaining this week before a missed day breaks the run.`;
    const metrics = createElement('div', { className: 'metrics' });
    [
        ['Current run', state.currentRun || 0],
        ['Longest run', state.longestRun || 0],
        ['Solves/week', state.solvesThisWeek || 0],
        ['Avg solve', formatDuration(state.averageTimeToSolveMs || 0)],
        ['Fail rate', `${Math.round(Number(state.failRate || 0) * 100)}%`],
    ].forEach(([label, value]) => {
        const metric = createElement('div', { className: 'metric' });
        metric.title = tooltip;
        metric.append(
            createElement('span', { className: 'metric-label', text: label }),
            createElement('span', { className: 'metric-value', text: String(value) }),
        );
        metrics.append(metric);
    });
    return metrics;
}

function getReceiptSvg(state) {
    return renderReceiptSvg({
        ...(state.solveReceipt || {}),
        currentRun: state.solveReceipt?.currentRun ?? state.currentRun,
        cognitiveIndex: getCognitiveIndex(state),
    });
}

function getCognitiveIndex(state) {
    return computeCognitiveIndex({
        solvesInLast7d: Number(state.solvesThisWeek || state.currentRun || 0),
        currentRun: Number(state.currentRun || 0),
        averageTimeToSolveMs: Number(state.averageTimeToSolveMs || state.solveReceipt?.timeToSolveMs),
        failRate: Number(state.failRate || 0),
        sourceDiversityRatio: new Set(state.enabledSources || []).size > 1 ? 1 : 0,
        bypassesThisWeek: Number(state.bypassesThisWeek || 0),
    });
}

function getBadgeSvg(state) {
    return renderBadgeSvg({
        cognitiveIndex: getCognitiveIndex(state),
        longestRun: state.longestRun ?? state.currentRun,
    });
}

function getLocalBadgeMarkdown() {
    return '![Dorso Cognitive Index](./dorso-cognitive-index.svg)';
}

function getLocalBadgeHtml() {
    return '<img src="./dorso-cognitive-index.svg" alt="Dorso Cognitive Index">';
}

async function copyReceiptImage(state) {
    if (!globalThis.ClipboardItem || !navigator.clipboard?.write) {
        throw new Error('Image clipboard unavailable.');
    }

    const blob = await rasterizeSvgToPng(getReceiptSvg(state));
    await navigator.clipboard.write([
        new ClipboardItem({
            [blob.type]: blob,
        }),
    ]);
}

async function shareReceipt(state) {
    const text = createSolveShareText(state.solveReceipt);
    const blob = await rasterizeSvgToPng(getReceiptSvg(state));
    const file = new File([blob], SOLVE_SHARE_TEXT.imageName, { type: blob.type });

    if (navigator.share) {
        const shareData = {
            title: SOLVE_SHARE_TEXT.title,
            text,
            files: [file],
        };
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share(shareData);
        } else {
            await navigator.share({
                title: SOLVE_SHARE_TEXT.title,
                text,
            });
        }
        return;
    }

    await navigator.clipboard.writeText(text);
    await copyReceiptImage(state);
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
            createRunMetrics(state),
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
    const fastActive = Boolean(state.aiFast?.active);
    panel.append(
        createElement('span', {
            className: 'status-pill',
            text: fastActive ? 'AI Fast' : (state.isPaused ? 'Paused' : 'Protecting'),
        }),
        createElement('h2', {
            text: fastActive
                ? 'AI fast is active.'
                : (state.isPaused ? 'Dorso is paused.' : 'Dorso is protecting selected sites.'),
        }),
        createElement('p', {
            text: fastActive
                ? 'Selected chatbot sites stay locked behind challenge verification until the fast ends.'
                : (state.isPaused
                    ? 'Protected chatbot sites are temporarily open until you resume Dorso.'
                    : 'Visit a selected chatbot site and Dorso will require challenge verification before the page becomes usable.'),
        }),
        createRunMetrics(state),
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

    const buttons = [
        createButton({
            label: 'Get Another',
            className: 'button-secondary',
            id: 'refreshChallengeButton',
            onClick: () => startChallenge(true),
        }),
    ];
    if (challenge.url) {
        buttons.unshift(createButton({
            label: 'Open Challenge',
            className: 'button-primary',
            id: 'openChallengeButton',
            onClick: () => {
                window.open(challenge.url, '_blank', 'noopener,noreferrer');
            },
        }));
    }
    if (challenge.source === 'aoc') {
        buttons.push(createButton({
            label: 'Check AoC Completion',
            className: 'button-primary',
            id: 'checkAocButton',
            onClick: async (event) => {
                event.currentTarget.disabled = true;
                const result = await sendRuntimeMessage({
                    action: MESSAGE_ACTIONS.SUBMISSION_RESULT,
                    source: challenge.source,
                    slug: challenge.slug,
                    submission: { method: 'session' },
                });
                setMessage(
                    result.success
                        ? 'Advent of Code completion verified.'
                        : (result.message || result.error || 'Advent of Code completion not verified.'),
                    Boolean(result.success),
                );
                await loadState();
            },
        }));
    }

    panel.append(
        createSectionHead(
            challenge.title,
            `${SOURCE_LABELS[challenge.source] || challenge.source} • ${challenge.difficulty} • ${challenge.selection_mode}`,
        ),
        createElement('p', { text: challenge.guidance }),
        createChipRow(challenge.topic_tags || []),
        createButtonRow(buttons),
    );
}

function renderSolveReceipt(state) {
    const panel = document.getElementById('sharePanel');
    resetPanel(panel);

    if (!state.hasActiveSession || !state.solveReceipt) {
        panel.hidden = true;
        return;
    }

    panel.hidden = false;
    panel.append(
        createSectionHead(
            'Solve Receipt',
            `${state.solveReceipt.problemTitle} • ${state.solveReceipt.sourceLabel}`,
        ),
        createButtonRow([
            createButton({
                label: 'Share',
                className: 'button-primary',
                onClick: async () => {
                    try {
                        await shareReceipt(state);
                        setMessage('Receipt shared.', true);
                    } catch (error) {
                        await navigator.clipboard.writeText(createSolveShareText(state.solveReceipt));
                        setMessage(`Receipt text copied. ${error.message}`, true);
                    }
                },
            }),
            createButton({
                label: 'Copy text',
                className: 'button-secondary',
                onClick: async () => {
                    await navigator.clipboard.writeText(createSolveShareText(state.solveReceipt));
                    setMessage('Receipt text copied.', true);
                },
            }),
            createButton({
                label: 'Copy image',
                className: 'button-secondary',
                onClick: async () => {
                    try {
                        await copyReceiptImage(state);
                        setMessage('Receipt image copied.', true);
                    } catch (error) {
                        setMessage(error.message);
                    }
                },
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

    const bypassSelect = createElement('select', { id: 'emergencyBypassSelect' });
    EMERGENCY_BYPASS_OPTIONS.forEach((count) => {
        const option = createElement('option', { text: `${count} / week` });
        option.value = String(count);
        bypassSelect.append(option);
    });
    bypassSelect.value = String(state.emergencyBypassesPerWeek ?? 2);
    bypassSelect.addEventListener('change', async () => {
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                emergencyBypassesPerWeek: Number(bypassSelect.value),
            },
        });
        setMessage('Emergency bypass limit saved.', true);
        await loadState();
    });

    const bypassLabel = createElement('label', { className: 'field-label' });
    bypassLabel.append(
        createElement('span', { text: 'Emergency bypasses' }),
        bypassSelect,
        createElement('span', {
            className: 'small',
            text: `${state.emergencyBypassesRemaining ?? 0} remaining this week`,
        }),
    );

    const healthLabel = createElement('div', { className: 'field-label' });
    healthLabel.append(
        createElement('span', { text: 'Message health' }),
        createElement('span', {
            className: 'small',
            text: `${Number(state.messageFailureCount || 0)} failed runtime messages`,
        }),
    );

    const pauseButton = createButton({
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
    });
    pauseButton.disabled = Boolean(state.aiFast?.active);

    panel.append(
        createSectionHead(
            'Controls',
            'Pause protection, set session length, or tune the weekly emergency escape valve.',
        ),
        createElement('div', { className: 'field-grid' }),
        createButtonRow([
            pauseButton,
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
    panel.querySelector('.field-grid').append(durationLabel, bypassLabel, healthLabel);

    if (state.aiFast?.active) {
        panel.append(createElement('p', {
            className: 'small',
            text: 'AI fast is active. Pause and emergency bypass are unavailable.',
        }));
    }
}

function renderAiFast(state) {
    const panel = document.getElementById('fastPanel');
    resetPanel(panel);

    const aiFast = state.aiFast || {};
    const durationSelect = createElement('select');
    AI_FAST_DURATION_HOURS.forEach((hours) => {
        const option = createElement('option', { text: hours === 24 ? '24h' : `${Math.round(hours / 24)}d` });
        option.value = String(hours);
        durationSelect.append(option);
    });
    durationSelect.value = String(aiFast.durationHours || 24);

    const durationLabel = createElement('label', { className: 'field-label' });
    durationLabel.append(createElement('span', { text: 'Duration' }), durationSelect);
    const summary = aiFast.plannedSummary || { solves: 0, drillsCompleted: 0 };
    const details = createElement('div', { className: 'list' });
    details.append(
        createElement('div', {
            className: 'list-item',
            text: aiFast.active
                ? `Ends ${new Date(aiFast.endsAt).toLocaleString()} (${formatDuration(aiFast.remainingMs)} remaining)`
                : (aiFast.startedAt ? `Last fast ended ${new Date(aiFast.endsAt).toLocaleString()}` : 'No AI fast recorded.'),
        }),
        createElement('div', {
            className: 'list-item',
            text: `Solves ${summary.solves || 0} | Drills ${summary.drillsCompleted || 0}`,
        }),
    );

    const buttons = [];
    if (!aiFast.active) {
        buttons.push(createButton({
            label: 'Start AI Fast',
            className: 'button-primary',
            onClick: async () => {
                await sendRuntimeMessage({
                    action: MESSAGE_ACTIONS.START_AI_FAST,
                    durationHours: Number(durationSelect.value),
                });
                await loadState();
            },
        }));
    }

    if (aiFast.startedAt && !aiFast.active) {
        buttons.push(createButton({
            label: 'Export ICS',
            className: 'button-secondary',
            onClick: async () => {
                const result = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.EXPORT_AI_FAST_ICS });
                setMessage(result.success ? 'AI fast calendar exported.' : result.error, Boolean(result.success));
                await loadState();
            },
        }));
    }

    panel.append(
        createSectionHead(
            'AI Fast',
            aiFast.active ? 'Emergency bypass and pause are locked until the fast ends.' : 'Start a 24h, 7d, or 30d AI fast.',
        ),
        durationLabel,
        details,
        createButtonRow(buttons),
    );
}

function renderCliExport(state) {
    const panel = document.getElementById('cliPanel');
    resetPanel(panel);

    const form = createElement('form', { className: 'form-grid' });
    const enabledLabel = createElement('label', { className: 'checkbox-card' });
    const enabledCheckbox = createElement('input', { type: 'checkbox' });
    const pathLabel = createElement('label', { className: 'field-label' });
    const pathInput = createElement('input', { type: 'text' });
    const statusText = createElement('span', { className: 'small' });

    enabledCheckbox.name = 'cliStatusExportEnabled';
    enabledCheckbox.checked = Boolean(state.cliStatusExportEnabled);
    pathInput.name = 'cliStatusExportPath';
    pathInput.value = state.cliStatusExportPath || DEFAULT_CLI_STATUS_EXPORT_PATH;
    pathInput.placeholder = DEFAULT_CLI_STATUS_EXPORT_PATH;
    statusText.textContent = state.cliStatusExportError
        ? `Last error: ${state.cliStatusExportError}`
        : `Last export: ${state.cliStatusLastExportedAt ? new Date(state.cliStatusLastExportedAt).toLocaleString() : 'never'}`;

    enabledLabel.append(enabledCheckbox, createElement('span', { text: 'Write CLI status JSON' }));
    pathLabel.append(
        createElement('span', { text: 'Downloads-relative path' }),
        pathInput,
        createElement('span', { className: 'small', text: 'Used by dorso status --path.' }),
    );
    form.append(
        enabledLabel,
        pathLabel,
        statusText,
        createButtonRow([
            createButton({
                label: 'Save CLI Export',
                className: 'button-primary',
                type: 'submit',
                onClick: () => {},
            }),
            createButton({
                label: 'Export Now',
                className: 'button-secondary',
                onClick: async () => {
                    const result = await sendRuntimeMessage({ action: MESSAGE_ACTIONS.EXPORT_CLI_STATUS });
                    setMessage(result.success ? 'CLI status exported.' : result.error, Boolean(result.success));
                    await loadState();
                },
            }),
        ]),
    );

    form.onsubmit = async (event) => {
        event.preventDefault();
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                cliStatusExportEnabled: enabledCheckbox.checked,
                cliStatusExportPath: pathInput.value,
            },
        });
        setMessage('CLI export settings saved.', true);
        await loadState();
    };

    panel.append(createSectionHead(
        'CLI Export',
        'Write a local JSON status file for the dorso CLI.',
    ), form);
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

function renderSources(state) {
    const form = document.getElementById('sourcesForm');
    const enabledSources = new Set(state.enabledSources || []);
    resetPanel(form);

    const checkboxGrid = createElement('div', { className: 'checkbox-grid' });
    state.supportedSources.forEach((source) => {
        const label = createElement('label', { className: 'checkbox-card' });
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'enabledSources';
        checkbox.value = source.id;
        checkbox.checked = enabledSources.has(source.id);
        checkbox.disabled = !source.isAvailable;
        label.append(checkbox, createElement('span', {
            text: source.isAvailable ? source.label : `${source.label} (coming soon)`,
        }));
        checkboxGrid.append(label);
    });

    const aocSettings = createElement('div', { className: 'list-item' });
    const aocHashLabel = createElement('label', { className: 'field-label' });
    const aocHashInput = createElement('textarea');
    aocHashInput.name = 'aocAnswerHashes';
    aocHashInput.rows = 5;
    aocHashInput.placeholder = 'aoc-2025-01-part-1 64-char-sha256';
    aocHashInput.value = formatAocHashText(state.aocAnswerHashes);
    aocHashLabel.append(
        createElement('span', { text: 'Advent of Code answer hashes' }),
        aocHashInput,
        createElement('span', {
            className: 'small',
            text: `${state.aocAnswerHashCount || 0} saved. Optional fallback when session-page verification is unavailable.`,
        }),
    );
    aocSettings.append(
        createElement('strong', { text: 'Advent of Code' }),
        createElement('span', {
            className: 'small',
            text: state.aocPermissionGranted ? 'AoC permission granted.' : 'AoC permission not granted.',
        }),
        createButtonRow([
            createButton({
                label: 'Grant AoC Permission',
                className: 'button-secondary',
                onClick: async () => {
                    const granted = await requestOptionalHostPermission(AOC_ORIGIN);
                    setMessage(granted ? 'Advent of Code permission granted.' : 'Advent of Code permission not granted.', granted);
                    await loadState();
                },
            }),
        ]),
        aocHashLabel,
    );

    form.append(
        checkboxGrid,
        aocSettings,
        createButton({
            label: 'Save Sources',
            className: 'button-primary',
            type: 'submit',
            onClick: () => {},
        }),
    );

    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const sourceSelection = getSourceSelection(formData.getAll('enabledSources'));
        let aocAnswerHashes = {};

        if (!sourceSelection.hasSelection) {
            setMessage(sourceSelection.message);
            return;
        }

        try {
            aocAnswerHashes = parseAocHashText(formData.get('aocAnswerHashes'));
        } catch (error) {
            setMessage(error.message);
            return;
        }

        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                enabledSources: sourceSelection.enabledSources,
                aocAnswerHashes,
            },
        });
        setMessage('Challenge sources saved.', true);
        await loadState();
    };
}

function renderTargetRules(state) {
    const form = document.getElementById('rulesForm');
    const availableSources = state.supportedSources
        .filter((source) => source.isAvailable)
        .map((source) => source.id);
    resetPanel(form);

    const list = createElement('div', { className: 'list' });
    state.supportedTargets.forEach((target) => {
        const origin = getTargetOrigin(target);
        const rule = normalizeTargetRule(state.perTargetRules?.[origin], availableSources);
        const row = createElement('div', { className: 'list-item target-rule-row' });
        const controls = createElement('div', { className: 'rule-grid' });
        const scheduleSelect = createSelect(
            `${origin}::schedule`,
            rule.schedule,
            TARGET_RULE_SCHEDULES,
            scheduleLabels,
        );
        const customLabel = createElement('label', { className: 'field-label' });
        const customInput = createElement('input', { type: 'text' });
        const difficultySelect = createSelect(
            `${origin}::difficultyOverride`,
            rule.difficultyOverride,
            TARGET_RULE_DIFFICULTIES,
            difficultyLabels,
        );
        const scheduleLabel = createElement('label', { className: 'field-label' });
        const difficultyLabel = createElement('label', { className: 'field-label' });

        customInput.name = `${origin}::customCron`;
        customInput.value = rule.customCron || DEFAULT_TARGET_RULE.customCron;
        customInput.placeholder = '1-5 09:00-17:00';
        customLabel.hidden = !['weekdays', 'custom'].includes(rule.schedule);
        scheduleSelect.addEventListener('change', () => {
            customLabel.hidden = !['weekdays', 'custom'].includes(scheduleSelect.value);
        });

        scheduleLabel.append(createElement('span', { text: 'Schedule' }), scheduleSelect);
        customLabel.append(
            createElement('span', { text: 'Custom window' }),
            customInput,
            createElement('span', { className: 'small', text: 'Format: 1-5 09:00-17:00; 0 is Sunday.' }),
        );
        difficultyLabel.append(createElement('span', { text: 'Difficulty' }), difficultySelect);
        controls.append(scheduleLabel, customLabel, difficultyLabel);

        const sourceGrid = createElement('div', { className: 'rule-source-grid' });
        state.supportedSources.forEach((source) => {
            const label = createElement('label', { className: 'checkbox-card' });
            const checkbox = createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = `${origin}::sourcesOverride`;
            checkbox.value = source.id;
            checkbox.checked = rule.sourcesOverride.includes(source.id);
            checkbox.disabled = !source.isAvailable;
            label.append(checkbox, createElement('span', {
                text: source.isAvailable ? source.label : `${source.label} (coming soon)`,
            }));
            sourceGrid.append(label);
        });

        row.append(
            createElement('strong', { text: target.label }),
            createElement('span', { className: 'small', text: origin }),
            controls,
            createElement('span', { className: 'small', text: 'Source override; leave blank to use global sources.' }),
            sourceGrid,
        );
        list.append(row);
    });

    form.append(
        list,
        createButton({
            label: 'Save Domain Rules',
            className: 'button-primary',
            type: 'submit',
            onClick: () => {},
        }),
    );

    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const perTargetRules = {};
        state.supportedTargets.forEach((target) => {
            const origin = getTargetOrigin(target);
            perTargetRules[origin] = {
                schedule: formData.get(`${origin}::schedule`) || DEFAULT_TARGET_RULE.schedule,
                customCron: formData.get(`${origin}::customCron`) || DEFAULT_TARGET_RULE.customCron,
                difficultyOverride: formData.get(`${origin}::difficultyOverride`) || DEFAULT_TARGET_RULE.difficultyOverride,
                sourcesOverride: formData.getAll(`${origin}::sourcesOverride`),
            };
        });

        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: { perTargetRules },
        });
        setMessage('Domain rules saved.', true);
        await loadState();
    };
}

function createOnboardingStep(title, copy) {
    const panel = createElement('section', { className: 'panel' });
    panel.append(createSectionHead(title, copy));
    return panel;
}

function appendSourceCheckboxes(panel, state) {
    const enabledSources = new Set(state.enabledSources || []);
    const checkboxGrid = createElement('div', { className: 'checkbox-grid' });
    state.supportedSources.forEach((source) => {
        const label = createElement('label', { className: 'checkbox-card' });
        const checkbox = createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'enabledSources';
        checkbox.value = source.id;
        checkbox.checked = enabledSources.has(source.id);
        checkbox.disabled = !source.isAvailable;
        label.append(checkbox, createElement('span', {
            text: source.isAvailable ? source.label : `${source.label} (coming soon)`,
        }));
        checkboxGrid.append(label);
    });
    panel.append(checkboxGrid);
}

function appendTargetCheckboxes(panel, state) {
    const enabledTargetIds = new Set(state.enabledTargetIds || []);
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
    panel.append(checkboxGrid);
}

function renderOnboarding(state) {
    const panel = document.getElementById('onboardingPanel');
    resetPanel(panel);
    panel.hidden = false;

    const form = createElement('form', { className: 'onboarding-grid' });
    const sourceStep = createOnboardingStep('Pick Sources', 'Choose which challenge pools Dorso can assign.');
    const targetStep = createOnboardingStep('Pick Sites', 'Choose which chatbot domains Dorso should protect.');
    const receiptStep = createOnboardingStep('Sample Receipt', 'A solve receipt appears after each verified unlock.');
    const preview = createElement('img', { className: 'receipt-preview' });
    preview.alt = 'Sample Dorso solve receipt';
    preview.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderReceiptSvg({
        problemTitle: 'Binary Search Drill',
        sourceLabel: 'MCQ',
        timeToSolveMs: 184000,
        currentRun: 3,
        cognitiveIndex: 82,
    }))}`;

    appendSourceCheckboxes(sourceStep, state);
    appendTargetCheckboxes(targetStep, state);
    receiptStep.append(
        preview,
        createButtonRow([
            createButton({
                label: 'Enter Dashboard',
                className: 'button-primary',
                type: 'submit',
                onClick: () => {},
            }),
        ]),
    );

    form.append(sourceStep, targetStep, receiptStep);
    form.onsubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const sourceSelection = getSourceSelection(formData.getAll('enabledSources'));

        if (!sourceSelection.hasSelection) {
            setMessage(sourceSelection.message);
            return;
        }

        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                enabledSources: sourceSelection.enabledSources,
                enabledTargetIds: formData.getAll('enabledTargetIds'),
                hasCompletedOnboarding: true,
            },
        });
        setMessage('Setup saved.', true);
        await loadState();
    };

    panel.append(form);
}

function renderCorruptedStateFallback() {
    setMainPanelsHidden(false);
    const onboardingPanel = document.getElementById('onboardingPanel');
    resetPanel(onboardingPanel);
    onboardingPanel.hidden = true;
    ['statusPanel', 'challengePanel', 'sharePanel', 'controlPanel', 'fastPanel', 'cliPanel', 'badgePanel', 'disclosurePanel'].forEach((panelId) => {
        resetPanel(document.getElementById(panelId));
    });
    document.getElementById('sharePanel').hidden = true;
    resetPanel(document.getElementById('sitesForm'));
    resetPanel(document.getElementById('sourcesForm'));
    resetPanel(document.getElementById('rulesForm'));
    setMessage('');

    const panel = document.getElementById('statusPanel');
    panel.append(
        createElement('h2', { text: 'Extension state corrupted. Click Reset.' }),
        createElement('p', { text: 'This clears local extension storage and reinitializes Dorso.' }),
        createButtonRow([
            createButton({
                label: 'Reset',
                className: 'button-primary',
                onClick: async () => {
                    await clearStorage();
                    await loadState();
                },
            }),
        ]),
    );
}

async function renderBadge(state) {
    const panel = document.getElementById('badgePanel');
    resetPanel(panel);
    const localBadgeSvg = getBadgeSvg(state);

    panel.append(
        createSectionHead(
            'Local Badge',
            'Export a serverless Cognitive Index card for README or social use.',
        ),
        createSnippetField('README Markdown', getLocalBadgeMarkdown()),
        createSnippetField('README HTML', getLocalBadgeHtml()),
        createButtonRow([
            createButton({
                label: 'Download SVG',
                className: 'button-primary',
                onClick: () => {
                    downloadTextFile('dorso-cognitive-index.svg', localBadgeSvg, 'image/svg+xml');
                    setMessage('Badge SVG downloaded.', true);
                },
            }),
            createButton({
                label: 'Download PNG',
                className: 'button-secondary',
                onClick: async () => {
                    await downloadBadgePng(localBadgeSvg);
                    setMessage('Badge PNG downloaded.', true);
                },
            }),
        ]),
    );

    const config = globalThis.DorsoBadgeConfig || {};
    const embeds = await createBadgeEmbeds({
        dashboardState: state,
        secret: config.hmacSecret,
        baseUrl: config.baseUrl,
    });

    panel.append(createSectionHead(
        'Hosted Embed',
        'Copy a signed Cognitive Index embed for README use.',
    ));

    if (!embeds.available) {
        panel.append(createElement('p', { text: embeds.reason }));
    } else {
        panel.append(
            createSnippetField('Markdown', embeds.markdown),
            createSnippetField('HTML', embeds.html),
            createButtonRow([
                createButton({
                    label: 'Copy Markdown',
                    className: 'button-primary',
                    onClick: async () => {
                        await navigator.clipboard.writeText(embeds.markdown);
                        setMessage('Badge markdown copied.', true);
                    },
                }),
                createButton({
                    label: 'Copy HTML',
                    className: 'button-secondary',
                    onClick: async () => {
                        await navigator.clipboard.writeText(embeds.html);
                        setMessage('Badge HTML copied.', true);
                    },
                }),
            ]),
        );
    }

    const leaderboardForm = createElement('form', { className: 'form-grid' });
    const repoLabel = createElement('label', { className: 'field-label' });
    const repoInput = createElement('input', { type: 'text' });
    repoInput.value = state.leaderboardRepoUrl || '';
    repoInput.placeholder = 'https://github.com/user/repo';
    repoLabel.append(
        createElement('span', { text: 'Leaderboard repo URL' }),
        repoInput,
        createElement('span', { className: 'small', text: 'Opt-in; Dorso posts only anonymous hashes and score fields.' }),
    );
    leaderboardForm.append(
        repoLabel,
        createButtonRow([
            createButton({
                label: 'Submit Score',
                className: 'button-primary',
                type: 'submit',
                onClick: () => {},
            }),
        ]),
    );
    leaderboardForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
            const submission = await createLeaderboardSubmission({
                dashboardState: state,
                repoUrl: repoInput.value,
                secret: config.hmacSecret,
                baseUrl: config.baseUrl,
            });
            if (!submission.available) {
                throw new Error(submission.reason);
            }

            const endpointOrigin = new URL(submission.endpoint).origin;
            const granted = await requestOptionalHostPermission(endpointOrigin);
            if (!granted) {
                throw new Error('Leaderboard host permission was not granted.');
            }

            const response = await fetch(submission.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-dorso-signature': submission.sig,
                },
                body: submission.body,
            });
            if (!response.ok) {
                throw new Error(`Leaderboard submit failed: HTTP ${response.status}`);
            }

            await sendRuntimeMessage({
                action: MESSAGE_ACTIONS.SAVE_SETTINGS,
                payload: {
                    leaderboardRepoUrl: repoInput.value,
                },
            });
            setMessage('Leaderboard score submitted.', true);
            await loadState();
        } catch (error) {
            setMessage(error.message || 'Leaderboard submit failed.');
        }
    };
    panel.append(createSectionHead(
        'Leaderboard',
        'Opt in to a public repo-scoped leaderboard.',
    ), leaderboardForm);
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
            copy: 'Dorso links to official challenge pages instead of rehosting third-party problem statements inside the extension.',
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
    if (!validateDashboardState(response?.state)) {
        renderCorruptedStateFallback();
        return;
    }

    latestState = response.state;
    latestWhatIAsked = await getWhatIAskedEntries();

    if (!latestState.hasCompletedOnboarding) {
        clearTimers();
        setMessage('');
        setMainPanelsHidden(true);
        renderOnboarding(latestState);
        return;
    }

    const onboardingPanel = document.getElementById('onboardingPanel');
    resetPanel(onboardingPanel);
    onboardingPanel.hidden = true;
    setMainPanelsHidden(false);
    setMessage(latestState.uiMessage || latestState.leetcodeDetectionWarning, latestState.hasActiveSession && !latestState.leetcodeDetectionWarning);
    renderStatus(latestState);
    renderChallenge(latestState);
    renderSolveReceipt(latestState);
    renderControls(latestState);
    renderAiFast(latestState);
    renderCliExport(latestState);
    await renderBadge(latestState);
    renderSources(latestState);
    renderSupportedSites(latestState);
    renderTargetRules(latestState);
    renderDisclosure(latestWhatIAsked);
}

loadState().catch((error) => {
    setMessage(`Unable to load Dorso state: ${error.message}`);
});
