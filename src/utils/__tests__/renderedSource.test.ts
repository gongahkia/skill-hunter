import { renderedSource } from '../renderedSource';
const url = 'https://sso.agc.gov.sg/Act/CA2004?WholeDoc=1';
function tabs(existing: Array<{ id: number; url: string }>) {
  const api = {
    query: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockResolvedValue({ id: 7 }),
    remove: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({ ok: true, html: 'Source text', url }),
  };
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { tabs: api } });
  return api;
}
afterEach(() => Reflect.deleteProperty(globalThis, 'chrome'));
it('uses a matching already-open source tab without closing it', async () => {
  const api = tabs([{ id: 5, url }]);
  expect((await renderedSource(url)).ok).toBe(true);
  expect(api.create).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
});
it('opens an inactive source tab and closes it after success or failure', async () => {
  const api = tabs([]);
  await renderedSource(url);
  expect(api.create).toHaveBeenCalledWith({ url, active: false });
  expect(api.remove).toHaveBeenCalledWith(7);
  api.sendMessage.mockResolvedValue({ ok: false, error: 'Access denied' });
  expect((await renderedSource(url)).ok).toBe(false);
  expect(api.remove).toHaveBeenCalledTimes(2);
});
it('does not reuse a source tab displaying a different legislative version', async () => {
  const api = tabs([{ id: 5, url: url + '&RevDate=20211231' }]);
  await renderedSource(url);
  expect(api.create).toHaveBeenCalled();
});
it('rejects unrelated origins and never opens a browser tab for them', async () => {
  const api = tabs([]);
  expect((await renderedSource('https://evil.test/Act/A')).ok).toBe(false);
  expect(api.create).not.toHaveBeenCalled();
});
