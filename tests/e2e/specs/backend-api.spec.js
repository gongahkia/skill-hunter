/**
 * E2E tests for backend API endpoints.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000/api/v1';

test.describe('Backend API E2E', () => {
  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health/');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('can register a new extension user', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/users/register/`, {
      data: {
        extension_id: `e2e-test-${Date.now()}`,
        browser: 'chrome',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.extension_id).toBeTruthy();
    expect(data.browser).toBe('chrome');
  });

  test('can check session status', async ({ request }) => {
    // First register a user
    const registerResponse = await request.post(`${BASE_URL}/users/register/`, {
      data: {
        extension_id: 'test-session-user',
        browser: 'chrome',
      },
    });
    expect(registerResponse.ok()).toBeTruthy();

    // Check session (should be inactive)
    const sessionResponse = await request.get(
      `${BASE_URL}/users/check-session/?extension_id=test-session-user`
    );
    expect(sessionResponse.ok()).toBeTruthy();

    const sessionData = await sessionResponse.json();
    expect(sessionData).toHaveProperty('has_active_session');
  });

  test('can get random problem from backend', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/problems/random/`);

    if (response.ok()) {
      const problem = await response.json();
      expect(problem).toHaveProperty('title');
      expect(problem).toHaveProperty('slug');
      expect(problem).toHaveProperty('difficulty');
    }
  });
});
