(function attachChatbotGate() {
    const browserApi = globalThis.browser ?? globalThis.chrome;
    const overlayId = 'dorso-gate-root';
    const whatIAskedKey = 'WHAT_I_ASKED';
    const whatIAskedLimit = 200;
    let overlayRoot = null;
    let latestState = null;
    let sessionExpiryTimer = null;

    const sendMessage = globalThis.DorsoMessaging.sendRuntimeMessage;

    async function getStorageValue(key) {
        const response = browserApi.storage.local.get([key]);
        if (response && typeof response.then === 'function') {
            const result = await response;
            return result[key];
        }

        return new Promise((resolve) => {
            browserApi.storage.local.get([key], (result) => {
                resolve(result?.[key]);
            });
        });
    }

    async function setStorageValues(values) {
        const response = browserApi.storage.local.set(values);
        if (response && typeof response.then === 'function') {
            return response;
        }

        return new Promise((resolve) => {
            browserApi.storage.local.set(values, resolve);
        });
    }

    async function appendWhatIAsked(target, text) {
        const trimmed = text.trim();
        if (!trimmed) {
            return false;
        }

        const entries = await getStorageValue(whatIAskedKey);
        const nextEntries = [
            ...(Array.isArray(entries) ? entries : []),
            {
                timestamp: Date.now(),
                target: target.id,
                text: trimmed,
            },
        ].slice(-whatIAskedLimit);

        await setStorageValues({ [whatIAskedKey]: nextEntries });
        return true;
    }

    async function whenBodyReady() {
        if (document.body) {
            return;
        }

        await new Promise((resolve) => {
            const observer = new MutationObserver(() => {
                if (!document.body) {
                    return;
                }

                observer.disconnect();
                resolve();
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });
        });
    }

    function setDocumentLocked(isLocked) {
        if (isLocked) {
            document.documentElement.setAttribute('data-dorso-locked', 'true');
            document.body?.setAttribute('data-dorso-locked', 'true');
            return;
        }

        document.documentElement.removeAttribute('data-dorso-locked');
        document.body?.removeAttribute('data-dorso-locked');
    }

    function injectBaseStyles() {
        if (document.getElementById('dorso-gate-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'dorso-gate-style';
        style.textContent = `
            html[data-dorso-locked="true"],
            body[data-dorso-locked="true"] {
                overflow: hidden !important;
            }
        `;
        document.documentElement.appendChild(style);
    }

    function destroyOverlay() {
        overlayRoot?.remove();
        overlayRoot = null;
        setDocumentLocked(false);
    }

    function clearSessionExpiryTimer() {
        if (!sessionExpiryTimer) {
            return;
        }

        window.clearTimeout(sessionExpiryTimer);
        sessionExpiryTimer = null;
    }

    window.addEventListener('beforeunload', clearSessionExpiryTimer);

    function scheduleRelock(state) {
        clearSessionExpiryTimer();

        if (!state.hasActiveSession || !state.session?.expiresAt) {
            return;
        }

        const delay = Math.max(0, new Date(state.session.expiresAt).getTime() - Date.now());
        sessionExpiryTimer = window.setTimeout(() => {
            loadState().catch(() => {
                destroyOverlay();
            });
        }, delay + 50);
    }

    function createElement(tagName, options = {}) {
        const element = document.createElement(tagName);

        if (options.className) {
            element.className = options.className;
        }

        if (options.id) {
            element.id = options.id;
        }

        if (options.text) {
            element.textContent = options.text;
        }

        return element;
    }

    function getCurrentTarget(state) {
        return state.supportedTargets.find((target) => {
            return target.matches.some((pattern) => {
                const prefix = pattern.replace('*', '');
                return location.href.startsWith(prefix);
            });
        }) || null;
    }

    function getTargetOrigin(target) {
        const hostname = target?.hostnames?.[0];
        return hostname ? `https://${hostname}` : '';
    }

    function getTargetRule(state, target) {
        return state.perTargetRules?.[getTargetOrigin(target)] || {
            schedule: 'always',
            customCron: '* 00:00-23:59',
            difficultyOverride: 'default',
            sourcesOverride: [],
        };
    }

    function parseTime(value) {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
        if (!match) {
            return null;
        }
        return (Number(match[1]) * 60) + Number(match[2]);
    }

    function expandDays(value) {
        if (value === '*') {
            return new Set([0, 1, 2, 3, 4, 5, 6]);
        }

        const days = new Set();
        for (const segment of value.split(',')) {
            const range = /^([0-6])-([0-6])$/.exec(segment);
            if (range) {
                const start = Number(range[1]);
                const end = Number(range[2]);
                if (start > end) {
                    return null;
                }
                for (let day = start; day <= end; day += 1) {
                    days.add(day);
                }
                continue;
            }

            if (/^[0-6]$/.test(segment)) {
                days.add(Number(segment));
                continue;
            }

            return null;
        }

        return days.size ? days : null;
    }

    function isWithinWindow(nowMinutes, startMinutes, endMinutes) {
        if (startMinutes <= endMinutes) {
            return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
        }

        return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
    }

    function isCustomRuleActive(customCron, date) {
        const match = /^(\*|[0-6](?:-[0-6])?(?:,[0-6](?:-[0-6])?)*)\s+([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)$/.exec(customCron);
        if (!match) {
            return true;
        }

        const days = expandDays(match[1]);
        const startMinutes = parseTime(match[2]);
        const endMinutes = parseTime(match[3]);
        if (!days || startMinutes === null || endMinutes === null) {
            return true;
        }

        const nowMinutes = (date.getHours() * 60) + date.getMinutes();
        return days.has(date.getDay()) && isWithinWindow(nowMinutes, startMinutes, endMinutes);
    }

    function isTargetRuleActive(rule, date = new Date()) {
        if (rule.schedule === 'weekdays') {
            const day = date.getDay();
            return day >= 1
                && day <= 5
                && isCustomRuleActive(rule.customCron || '* 00:00-23:59', date);
        }

        if (rule.schedule === 'weekends') {
            const day = date.getDay();
            return day === 0 || day === 6;
        }

        if (rule.schedule === 'custom') {
            return isCustomRuleActive(rule.customCron || '* 00:00-23:59', date);
        }

        return true;
    }

    function isGateActiveForState(state, target, targetRule) {
        const fastActive = Boolean(state.aiFast?.active);
        return Boolean(
            target
            && state.enabledTargetIds.includes(target.id)
            && (!state.isPaused || fastActive)
            && (fastActive || isTargetRuleActive(targetRule))
        );
    }

    function renderOverlay(state) {
        const target = getCurrentTarget(state);
        const challenge = state.currentChallenge;
        const targetRule = target ? getTargetRule(state, target) : null;

        if (
            state.hasActiveSession
            || !target
            || !isGateActiveForState(state, target, targetRule)
        ) {
            scheduleRelock(state);
            destroyOverlay();
            return;
        }

        if (!challenge) {
            destroyOverlay();
            return;
        }

        clearSessionExpiryTimer();
        injectBaseStyles();
        setDocumentLocked(true);

        if (!overlayRoot) {
            overlayRoot = document.createElement('div');
            overlayRoot.id = overlayId;
            document.documentElement.appendChild(overlayRoot);
        }

        const shadowRoot = overlayRoot.shadowRoot || overlayRoot.attachShadow({ mode: 'open' });
        shadowRoot.replaceChildren();

        const style = createElement('style');
        style.textContent = `
            :host { all: initial; }
            .dorso-backdrop {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
                color: #030712;
                font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                padding: 28px;
                box-sizing: border-box;
                overflow-y: auto;
            }
            .dorso-panel {
                width: min(720px, 100%);
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(229, 231, 235, 0.92);
                border-radius: 14px;
                box-shadow: 0 18px 50px rgba(37, 99, 235, 0.12);
                padding: 24px;
                box-sizing: border-box;
                backdrop-filter: blur(14px);
            }
            @media (min-height: 760px) {
                .dorso-backdrop {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .dorso-panel {
                    margin: 0;
                }
            }
            .dorso-kicker {
                margin: 0 0 8px;
                font-size: 12px;
                font-weight: 500;
                line-height: 16px;
                letter-spacing: 0;
                color: #2563eb;
            }
            .dorso-title {
                margin: 0;
                font-size: 36px;
                font-weight: 400;
                line-height: 43px;
                letter-spacing: 0;
            }
            .dorso-copy,
            .dorso-meta,
            .dorso-note {
                color: #4b5563;
                font-size: 16px;
                line-height: 26px;
            }
            .dorso-banner {
                margin: 16px 0 0;
                padding: 12px 14px;
                border-radius: 14px;
                background: #eff6ff;
                border: 1px solid rgba(37, 99, 235, 0.2);
                color: #2563eb;
                line-height: 1.4;
            }
            .dorso-card {
                margin: 18px 0;
                padding: 18px;
                border-radius: 14px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
            }
            .dorso-card h2 {
                margin: 0 0 10px;
                color: #030712;
                font-size: 18px;
                font-weight: 400;
                line-height: 22px;
            }
            .dorso-intent {
                display: grid;
                gap: 10px;
                margin: 18px 0 0;
            }
            .dorso-intent label {
                color: #4b5563;
                font-size: 14px;
                line-height: 1.4;
            }
            .dorso-intent textarea,
            .dorso-intent input:not([type="radio"]) {
                width: 100%;
                box-sizing: border-box;
                border-radius: 14px;
                border: 1px solid #e5e7eb;
                background: #ffffff;
                padding: 14px 16px;
                color: #030712;
                font: inherit;
            }
            .dorso-intent textarea {
                min-height: 78px;
                resize: vertical;
            }
            .dorso-intent-status {
                min-height: 1.2em;
                color: #15803d;
            }
            .dorso-chip-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            .dorso-chip {
                display: inline-flex;
                padding: 6px 10px;
                border-radius: 999px;
                background: #e5eef9;
                color: #030712;
                font-size: 12px;
                font-weight: 500;
                line-height: 16px;
            }
            .dorso-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-top: 18px;
            }
            .dorso-button,
            .dorso-link {
                appearance: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 0;
                border-radius: 999px;
                min-height: 44px;
                padding: 8px 18px;
                font: inherit;
                font-size: 16px;
                font-weight: 500;
                line-height: 24px;
                text-decoration: none;
                cursor: pointer;
            }
            .dorso-button-primary,
            .dorso-link-primary {
                background: #070709;
                color: #ffffff;
            }
            .dorso-button-secondary {
                background: #ffffff;
                color: #030712;
                border: 1px solid #e5e7eb;
            }
            .dorso-list {
                margin: 18px 0 0;
                padding-left: 18px;
                color: #4b5563;
                font-size: 14px;
                line-height: 22px;
            }
        `;

        const backdrop = createElement('div', { className: 'dorso-backdrop' });
        const panel = createElement('div', { className: 'dorso-panel' });
        const challengeCard = createElement('div', { className: 'dorso-card' });
        const intentForm = createElement('form', { className: 'dorso-intent' });
        const intentTextarea = createElement('textarea', { id: 'dorsoIntentText' });
        const intentStatus = createElement('span', { className: 'dorso-intent-status' });
        const chipRow = createElement('div', { className: 'dorso-chip-row' });
        const actionRow = createElement('div', { className: 'dorso-actions' });
        const list = createElement('ul', { className: 'dorso-list' });

        (challenge.topic_tags || []).forEach((tag) => {
            chipRow.append(createElement('span', {
                className: 'dorso-chip',
                text: tag,
            }));
        });

        const verificationCopy = challenge.source === 'leetcode'
            ? 'The overlay disappears automatically once LeetCode reports an accepted submission for this exact problem.'
            : 'The overlay disappears after the local answer verifies.';
        [
            verificationCopy,
            'Use the Dorso toolbar popup to change which supported sites stay protected.',
            'Unsupported websites are left untouched.',
        ].forEach((item) => {
            list.append(createElement('li', { text: item }));
        });

        if (challenge.url) {
            const openLink = createElement('a', {
                className: 'dorso-link dorso-link-primary',
                text: 'Open Challenge',
            });
            openLink.href = challenge.url;
            openLink.target = '_blank';
            openLink.rel = 'noreferrer';
            actionRow.append(openLink);
        }

        actionRow.append(createElement('button', {
            className: 'dorso-button dorso-button-secondary',
            id: 'dorsoSwapButton',
            text: 'Get Another',
        }));

        if (!state.aiFast?.active && Number(state.emergencyBypassesRemaining) > 0) {
            actionRow.append(createElement('button', {
                className: 'dorso-button dorso-button-secondary',
                id: 'dorsoBypassButton',
                text: `Emergency Bypass (${state.emergencyBypassesRemaining})`,
            }));
        }

        if (!state.aiFast?.active) {
            actionRow.append(
                createElement('button', {
                    className: 'dorso-button dorso-button-secondary',
                    id: 'dorsoPauseButton',
                    text: 'Pause Dorso',
                }),
            );
        }

        intentTextarea.rows = 3;
        intentForm.append(
            createElement('label', {
                text: 'What were you about to ask the chatbot? (optional)',
            }),
            intentTextarea,
            createElement('button', {
                className: 'dorso-button dorso-button-secondary',
                id: 'dorsoSaveIntentButton',
                text: 'Save Locally',
            }),
            intentStatus,
        );

        challengeCard.append(
            createElement('p', { className: 'dorso-meta', text: 'Assigned challenge' }),
            createElement('h2', { text: challenge.title }),
            createElement('p', {
                className: 'dorso-meta',
                text: `${challenge.source_label || challenge.source} • ${challenge.difficulty}`,
            }),
            createElement('p', {
                className: 'dorso-note',
                text: challenge.guidance,
            }),
            chipRow,
        );

        if (challenge.source === 'mcq') {
            const mcqForm = createElement('form', { className: 'dorso-intent' });
            (challenge.choices || []).forEach((choice, index) => {
                const label = createElement('label');
                const input = createElement('input');
                input.type = 'radio';
                input.name = 'dorsoMcqAnswer';
                input.value = String(index);
                label.append(input, document.createTextNode(` ${choice}`));
                mcqForm.append(label);
            });
            mcqForm.append(createElement('button', {
                className: 'dorso-button dorso-button-secondary',
                text: 'Submit Answer',
            }));
            mcqForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const selected = mcqForm.querySelector('input[name="dorsoMcqAnswer"]:checked');
                if (!selected) {
                    return;
                }

                await sendMessage({
                    action: 'submissionResult',
                    source: challenge.source,
                    slug: challenge.slug,
                    submission: Number(selected.value),
                });
                await loadState();
            });
            challengeCard.append(mcqForm);
        }

        if (challenge.source === 'drills') {
            const drillForm = createElement('form', { className: 'dorso-intent' });
            const drillTextarea = createElement('textarea');
            drillTextarea.rows = 3;
            drillForm.append(
                drillTextarea,
                createElement('button', {
                    className: 'dorso-button dorso-button-secondary',
                    text: 'Submit Answer',
                }),
            );
            drillForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                await sendMessage({
                    action: 'submissionResult',
                    source: challenge.source,
                    slug: challenge.slug,
                    submission: drillTextarea.value,
                });
                await loadState();
            });
            challengeCard.append(drillForm);
        }

        if (challenge.selection_mode === 'link_out_hash') {
            const answerForm = createElement('form', { className: 'dorso-intent' });
            const answerInput = createElement('input', { type: 'text' });
            answerInput.inputMode = 'numeric';
            answerInput.autocomplete = 'off';
            answerForm.append(
                answerInput,
                createElement('button', {
                    className: 'dorso-button dorso-button-secondary',
                    text: 'Submit Answer',
                }),
            );
            answerForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                await sendMessage({
                    action: 'submissionResult',
                    source: challenge.source,
                    slug: challenge.slug,
                    submission: answerInput.value,
                });
                await loadState();
            });
            challengeCard.append(answerForm);
        }

        panel.append(
            createElement('p', { className: 'dorso-kicker', text: 'Selected Site Blocked' }),
            createElement('h1', {
                className: 'dorso-title',
                text: `Dorso is holding ${target.label} until you solve a challenge.`,
            }),
            createElement('p', {
                className: 'dorso-copy',
                text: 'This public-store build keeps runtime state local. Dorso reads the supported site list, stores timers in extension storage, and verifies the assigned challenge source.',
            }),
        );

        if (state.uiMessage) {
            panel.append(createElement('p', {
                className: 'dorso-banner',
                text: state.uiMessage,
            }));
        }

        if (state.aiFast?.active) {
            panel.append(createElement('p', {
                className: 'dorso-banner',
                text: 'AI fast is active. Emergency bypass and pause are unavailable.',
            }));
        }

        panel.append(challengeCard, intentForm, actionRow, list);

        backdrop.append(panel);
        shadowRoot.append(style, backdrop);

        shadowRoot.getElementById('dorsoSwapButton').addEventListener('click', async () => {
            await sendMessage({ action: 'startChallenge', force: true, targetUrl: location.href });
            await loadState();
        });

        shadowRoot.getElementById('dorsoBypassButton')?.addEventListener('click', async (event) => {
            event.currentTarget.disabled = true;
            await sendMessage({ action: 'emergencyBypass' });
            await loadState();
        });

        shadowRoot.getElementById('dorsoPauseButton')?.addEventListener('click', async () => {
            await sendMessage({ action: 'setPaused', isPaused: true });
            await loadState();
        });

        intentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const saved = await appendWhatIAsked(target, intentTextarea.value);
            intentTextarea.value = '';
            intentStatus.textContent = saved ? 'Saved locally.' : '';
        });
    }

    async function loadState() {
        const response = await sendMessage({ action: 'requestState' });
        latestState = response.state;
        const target = getCurrentTarget(latestState);
        const targetRule = target ? getTargetRule(latestState, target) : null;

        if (
            !latestState.hasActiveSession
            && isGateActiveForState(latestState, target, targetRule)
        ) {
            await sendMessage({ action: 'startChallenge', force: false, targetUrl: location.href });
            latestState = (await sendMessage({ action: 'requestState' })).state;
        }

        renderOverlay(latestState);
    }

    browserApi.storage.onChanged.addListener(() => {
        if (!latestState) {
            return;
        }

        loadState().catch(() => {
            destroyOverlay();
        });
    });

    whenBodyReady()
        .then(loadState)
        .catch(() => {
            destroyOverlay();
        });
})();
