import { HoverCard } from '../card';
import { Annotations } from '../annotations';
let card: HoverCard;
let shadow: ShadowRoot;
const source = 'https://sso.agc.gov.sg/Act/Synthetic';
beforeEach(() => {
  document.body.innerHTML =
    '<div id="legisContent"><table><tr><td id="pr2-he-">Interpretation</td></tr><tr><td>Definition text</td></tr><tr><td><p>See section 2 and s 5 of the Misuse of Drugs Act 1973.</p></td></tr></table><a href="#pr2-he-">section 2</a></div>';
  const attach = Reflect.get(Element.prototype, 'attachShadow') as (
    this: Element,
    init: ShadowRootInit
  ) => ShadowRoot;
  jest.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init) {
    shadow = attach.call(this, init);
    return shadow;
  });
  const annotations = new Annotations(
    document.getElementById('legisContent') as HTMLElement,
    source
  );
  annotations.scan();
  card = new HoverCard(annotations, source);
});
afterEach(() => {
  card.destroy();
  jest.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});
it('opens a local preview by keyboard and Escape returns focus without reopening', async () => {
  const trigger = document.querySelector('p [data-skill-hunter-reference]') as HTMLElement;
  trigger.focus();
  await Promise.resolve();
  await Promise.resolve();
  const panel = shadow.querySelector('.card') as HTMLElement;
  expect(panel.hidden).toBe(false);
  expect(panel.textContent).toContain('Definition text');
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const close = shadow.querySelector('button') as HTMLButtonElement;
  expect(shadow.activeElement).toBe(close);
  close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await Promise.resolve();
  expect(panel.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
});
it('leaves native link clicks unchanged', () => {
  const trigger = document.querySelector('a [data-skill-hunter-reference]') as HTMLElement;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  trigger.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
it('does not reopen after a pending remote response arrives following dismissal', async () => {
  let finish: (value: unknown) => void = () => undefined;
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        sendMessage: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  });
  const trigger = Array.from(
    document.querySelectorAll<HTMLElement>('p [data-skill-hunter-reference]')
  ).find((el) => el.textContent?.includes('Misuse')) as HTMLElement;
  trigger.focus();
  card.hide();
  finish({
    ok: true,
    html: '<div id="legisContent"><table><tr><td id="pr5-he-">5. Heading</td></tr><tr><td>Remote text</td></tr></table></div>',
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect((shadow.querySelector('.card') as HTMLElement).hidden).toBe(true);
});
