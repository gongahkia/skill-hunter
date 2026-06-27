import {
    MESSAGE_ACTIONS,
    SESSION_DURATION_MINUTE_OPTIONS,
    SOURCE_LABELS,
    STORAGE_KEYS,
} from '../../shared/core/constants.js';
import { computeCognitiveIndex } from '../../shared/core/atrophy.js';
import { EMERGENCY_BYPASS_OPTIONS } from '../../shared/core/emergency-bypass.js';
import {
    DEFAULT_TARGET_RULE,
    TARGET_RULE_DIFFICULTIES,
    TARGET_RULE_SCHEDULES,
    getTargetOrigin,
    normalizeTargetRule,
} from '../../shared/core/target-rules.js';
import { formatDuration } from '../lib/formatters.js';
import {
    getDigestEntries,
    renderDigestMarkdown,
    renderDigestSvg,
} from '../lib/digest-svg.js';
import { renderReceiptSvg } from '../lib/receipt-svg.js';
import { createBadgeEmbeds } from '../lib/badge-url.js';
import {
    SOLVE_SHARE_TEXT,
    createSolveShareText,
} from './share-text.js';
import validateDashboardState from '../lib/dashboard-state-validator.js';
import {
    clearStorage,
    getStorageValues,
    sendRuntimeMessage,
    setStorageValues,
} from '../lib/browser-api.js';

let countdownTimer = null;
let latestState = null;
let latestWhatIAsked = [];
const redactedWhatIAskedTimestamps = new Set();
const mainPanelIds = [
    'statusPanel',
    'challengePanel',
    'controlPanel',
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
    const blob = await rasterizeSvgToPng(svg);
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

function createRunMetrics(state) {
    const tooltip = `${state.graceDaysRemaining ?? 0} grace day(s) remaining this week before a missed day breaks the run.`;
    const metrics = createElement('div', { className: 'metrics' });
    [
        ['Current run', state.currentRun || 0],
        ['Longest run', state.longestRun || 0],
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
        cognitiveIndex: computeCognitiveIndex({
            solvesInLast7d: Number(state.currentRun || 0),
            sourceDiversityRatio: new Set(state.enabledSources || []).size > 1 ? 1 : 0,
            bypassesThisWeek: Number(state.bypassesThisWeek || 0),
        }),
    });
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
                : 'Visit a selected chatbot site and Dorso will require challenge verification before the page becomes usable.',
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

    panel.append(
        createSectionHead(
            'Controls',
            'Pause protection, set session length, or tune the weekly emergency escape valve.',
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
    panel.querySelector('.field-grid').append(durationLabel, bypassLabel, healthLabel);
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

    form.append(
        checkboxGrid,
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
        const enabledSourcesValue = formData.getAll('enabledSources');

        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                enabledSources: enabledSourcesValue,
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
        await sendRuntimeMessage({
            action: MESSAGE_ACTIONS.SAVE_SETTINGS,
            payload: {
                enabledSources: formData.getAll('enabledSources'),
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
    ['statusPanel', 'challengePanel', 'sharePanel', 'controlPanel', 'badgePanel', 'disclosurePanel'].forEach((panelId) => {
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
    const config = globalThis.DorsoBadgeConfig || {};
    const embeds = await createBadgeEmbeds({
        dashboardState: state,
        secret: config.hmacSecret,
        baseUrl: config.baseUrl,
    });

    panel.append(createSectionHead(
        'Badge',
        'Copy a signed Cognitive Index embed for README use.',
    ));

    if (!embeds.available) {
        panel.append(createElement('p', { text: embeds.reason }));
        return;
    }

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
    await renderBadge(latestState);
    renderSources(latestState);
    renderSupportedSites(latestState);
    renderTargetRules(latestState);
    renderDisclosure(latestWhatIAsked);
}

loadState().catch((error) => {
    setMessage(`Unable to load Dorso state: ${error.message}`);
});
