function updateState(enabled, useSettingsInsteadOfPreferences) {
    const stateTitle = document.querySelector('[data-role="state-title"]');
    const stateCopy = document.querySelector('[data-role="state-copy"]');
    const button = document.querySelector('button.open-preferences');
    const settingsLabel = useSettingsInsteadOfPreferences ? 'Safari Settings' : 'Safari Extension Preferences';

    if (!(stateTitle instanceof HTMLElement) || !(stateCopy instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
        return;
    }

    if (typeof enabled === 'boolean') {
        document.body.dataset.extensionState = enabled ? 'enabled' : 'disabled';
        stateTitle.textContent = enabled ? 'Enabled in Safari' : 'Disabled in Safari';
        stateCopy.textContent = enabled
            ? `Skill Hunter is enabled. You can disable it in ${settingsLabel}.`
            : `Skill Hunter is disabled. Enable it in ${settingsLabel} before using the toolbar action.`;
    } else {
        document.body.dataset.extensionState = 'unknown';
        stateTitle.textContent = 'Status unavailable';
        stateCopy.textContent = `Open ${settingsLabel} to verify that Skill Hunter is enabled.`;
    }

    button.textContent = useSettingsInsteadOfPreferences
        ? 'Open Safari Settings'
        : 'Open Safari Extension Preferences';
}

function showPanel(panelName) {
    const panels = document.querySelectorAll('[data-panel]');
    const buttons = document.querySelectorAll('[data-panel-target]');

    panels.forEach((panel) => {
        panel.classList.toggle('is-active', panel.getAttribute('data-panel') === panelName);
    });

    buttons.forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-panel-target') === panelName);
    });
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage('open-preferences');
}

function show(enabled, useSettingsInsteadOfPreferences) {
    updateState(enabled, useSettingsInsteadOfPreferences);
}

document.querySelectorAll('[data-panel-target]').forEach((button) => {
    button.addEventListener('click', () => {
        showPanel(button.getAttribute('data-panel-target'));
    });
});

const preferencesButton = document.querySelector('button.open-preferences');
if (preferencesButton instanceof HTMLButtonElement) {
    preferencesButton.addEventListener('click', openPreferences);
}

showPanel('overview');
