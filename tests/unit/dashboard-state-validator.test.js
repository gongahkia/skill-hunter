import assert from 'node:assert/strict';
import test from 'node:test';
import validateDashboardState from '../../src/extension/lib/dashboard-state-validator.js';

function validState() {
    return {
        installId: 'dorso-install-test',
        hasActiveSession: false,
        session: {
            isActive: false,
            timeRemaining: 0,
        },
        currentChallenge: null,
        solveReceipt: null,
        enabledTargetIds: ['chatgpt'],
        enabledSources: ['mcq', 'drills'],
        perTargetRules: {
            'https://chatgpt.com': {
                schedule: 'always',
                customCron: '* 00:00-23:59',
                difficultyOverride: 'default',
                sourcesOverride: [],
            },
        },
        cliStatusExportEnabled: false,
        cliStatusExportPath: 'dorso/status.json',
        cliStatusLastExportedAt: null,
        cliStatusExportError: '',
        sessionDurationMinutes: 15,
        emergencyBypassesPerWeek: 2,
        bypassesThisWeek: 0,
        emergencyBypassesRemaining: 2,
        bypassWeekStart: 1782432000000,
        currentRun: 0,
        longestRun: 0,
        graceDaysRemaining: 1,
        isPaused: false,
        hasCompletedOnboarding: true,
        supportedTargets: [{
            id: 'chatgpt',
            label: 'ChatGPT',
            matches: ['https://chatgpt.com/*'],
        }],
        supportedSources: [{
            id: 'mcq',
            label: 'MCQ',
            isAvailable: true,
        }],
        uiMessage: '',
        messageFailureCount: 0,
        leetcodeDetectionWarning: '',
    };
}

test('DashboardState validator accepts background shape', () => {
    assert.equal(validateDashboardState(validState()), true);
});

test('DashboardState validator rejects corrupted state', () => {
    const state = validState();
    state.session = null;

    assert.equal(validateDashboardState(state), false);
});
