export class GoogleWorkspaceApiClient {
  constructor(private readonly accessToken: string) {}

  async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google API GET failed: ${body}`);
    }

    return (await response.json()) as T;
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API POST failed: ${errorText}`);
    }

    return (await response.json()) as T;
  }

  async putJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API PUT failed: ${errorText}`);
    }

    return (await response.json()) as T;
  }

  async clearRange(url: string): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API clear failed: ${errorText}`);
    }
  }
}
