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
