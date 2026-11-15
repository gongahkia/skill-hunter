import { sourceSnapshot } from '../sourceSnapshot';
const url = 'https://sso.agc.gov.sg/Act/CA2004?WholeDoc=1';
it('reads rendered legislation and strips extension markup without changing the page', async () => {
  document.body.innerHTML =
    '<div id="legisContent"><table><tr><td id="pr3-he-">3. Establishment</td></tr><tr><td><span data-skill-hunter-reference="1">Commission</span> wording.</td></tr></table></div><div id="skill-hunter-previews">Private UI</div>';
  const original = document.body.innerHTML;
  const response = await sourceSnapshot(document, url);
  expect(response.ok).toBe(true);
  expect(response.html).toContain('Commission wording.');
  expect(response.html).not.toContain('Private UI');
  expect(response.html).not.toContain('data-skill-hunter-reference');
  expect(document.body.innerHTML).toBe(original);
});
it('waits for JavaScript-rendered provisions and times out on an access error', async () => {
  document.body.innerHTML = '<div id="legisContent"></div>';
  const pending = sourceSnapshot(document, url);
  document
    .getElementById('legisContent')
    ?.insertAdjacentHTML('beforeend', '<div id="pr3-he-">3. Loaded</div>');
  expect((await pending).ok).toBe(true);
  document.body.innerHTML = 'Access denied';
  jest.useFakeTimers();
  const blocked = sourceSnapshot(document, url, 100);
  await jest.advanceTimersByTimeAsync(101);
  expect((await blocked).ok).toBe(false);
  jest.useRealTimers();
});
it('waits for the requested section when other provisions are already readable', async () => {
  document.body.innerHTML =
    '<div id="legisContent"><table><tbody><tr><td class="prov1Hdr" id="pr1-">Short title</td></tr><tr><td class="prov1Txt">Initially loaded provision.</td></tr></tbody></table></div>';
  let settled = false;
  const pending = sourceSnapshot(document, url, 1000, '21(9)');
  void pending.then(() => (settled = true));
  await Promise.resolve();
  expect(settled).toBe(false);
  document
    .querySelector('tbody')
    ?.insertAdjacentHTML(
      'beforeend',
      '<tr><td class="prov1Hdr" id="pr21-">Jurisdiction</td></tr><tr><td class="prov1Txt">Requested provision.</td></tr>'
    );
  const response = await pending;
  expect(response.ok).toBe(true);
  expect(response.html).toContain('Requested provision.');
});
it('reports an unavailable requested section instead of returning other provisions', async () => {
  document.body.innerHTML =
    '<div id="legisContent"><table><tr><td class="prov1Hdr" id="pr1-">Short title</td></tr><tr><td class="prov1Txt">Other provision.</td></tr></table></div>';
  jest.useFakeTimers();
  const pending = sourceSnapshot(document, url, 100, '21(9)');
  await jest.advanceTimersByTimeAsync(101);
  const response = await pending;
  expect(response.ok).toBe(false);
  expect(response.error).toContain('section 21(9)');
  expect(response.html).toBeUndefined();
  jest.useRealTimers();
});
it('rejects invalid provision requests without waiting', async () => {
  expect(await sourceSnapshot(document, url, 1000, '21#invalid')).toMatchObject({
    ok: false,
    error: 'Invalid provision request',
  });
});
