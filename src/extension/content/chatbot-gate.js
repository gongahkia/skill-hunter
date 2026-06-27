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

    function renderOverlay(state) {
        const target = getCurrentTarget(state);
        const challenge = state.currentChallenge;

        if (state.hasActiveSession || state.isPaused || !target || !state.enabledTargetIds.includes(target.id)) {
            scheduleRelock(state);
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
                background:
                    radial-gradient(circle at top right, rgba(209, 119, 60, 0.18), transparent 28%),
                    radial-gradient(circle at bottom left, rgba(115, 62, 28, 0.12), transparent 32%),
                    linear-gradient(160deg, #f8f4ec 0%, #efe3d4 100%);
                color: #191411;
                font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
                padding: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .dorso-panel {
                width: min(720px, 100%);
                background: rgba(255, 251, 243, 0.96);
                border: 1px solid rgba(25, 20, 17, 0.12);
                border-radius: 24px;
                box-shadow: 0 16px 40px rgba(54, 34, 20, 0.18);
                padding: 24px;
            }
            .dorso-kicker {
                margin: 0 0 8px;
                font-size: 0.72rem;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                color: #9a4516;
            }
            .dorso-title {
                margin: 0;
                font-size: 2rem;
                line-height: 1;
            }
            .dorso-copy,
            .dorso-meta,
            .dorso-note {
                color: #66594d;
                line-height: 1.5;
            }
            .dorso-banner {
                margin: 16px 0 0;
                padding: 12px 14px;
                border-radius: 12px;
                background: #fff1db;
                border: 1px solid rgba(161, 68, 25, 0.28);
                color: #713611;
                line-height: 1.4;
            }
            .dorso-card {
                margin: 18px 0;
                padding: 18px;
                border-radius: 18px;
                background: #fff8ea;
                border: 1px solid rgba(25, 20, 17, 0.08);
            }
            .dorso-card h2 {
                margin: 0 0 10px;
                font-size: 1.3rem;
            }
            .dorso-intent {
                display: grid;
                gap: 10px;
                margin: 18px 0 0;
            }
            .dorso-intent label {
                color: #66594d;
                line-height: 1.4;
            }
            .dorso-intent textarea {
                width: 100%;
                min-height: 78px;
                resize: vertical;
                border-radius: 14px;
                border: 1px solid rgba(25, 20, 17, 0.14);
                background: #fffdf7;
                padding: 12px;
                color: #191411;
                font: inherit;
            }
            .dorso-intent-status {
                min-height: 1.2em;
                color: #1b7f5f;
            }
            .dorso-chip-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            .dorso-chip {
                display: inline-flex;
                padding: 6px 11px;
                border-radius: 999px;
                background: rgba(161, 68, 25, 0.08);
                font-size: 0.88rem;
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
                padding: 12px 18px;
                font: inherit;
                text-decoration: none;
                cursor: pointer;
            }
            .dorso-button-primary,
            .dorso-link-primary {
                background: linear-gradient(135deg, #a14419, #cb6f35);
                color: #fff8f3;
            }
            .dorso-button-secondary {
                background: rgba(25, 20, 17, 0.08);
                color: #191411;
            }
            .dorso-list {
                margin: 18px 0 0;
                padding-left: 18px;
                color: #66594d;
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

        if (Number(state.emergencyBypassesRemaining) > 0) {
            actionRow.append(createElement('button', {
                className: 'dorso-button dorso-button-secondary',
                id: 'dorsoBypassButton',
                text: `Emergency Bypass (${state.emergencyBypassesRemaining})`,
            }));
        }

        actionRow.append(
            createElement('button', {
                className: 'dorso-button dorso-button-secondary',
                id: 'dorsoPauseButton',
                text: 'Pause Dorso',
            }),
        );

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

        shadowRoot.getElementById('dorsoPauseButton').addEventListener('click', async () => {
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

        if (!latestState.currentChallenge && !latestState.hasActiveSession && !latestState.isPaused) {
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
