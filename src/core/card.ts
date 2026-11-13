import type { Preview, Reference } from '@/types';
import { ANNOTATION_ATTR } from '@/utils/constants';
import styles from '@/styles/main.css?inline';
import { Annotations } from './annotations';
import { PreviewResolver, unavailablePreview } from './preview';

export class HoverCard {
  private host = document.createElement('div');
  private shadow = this.host.attachShadow({ mode: 'closed' });
  private card = document.createElement('section');
  private active: Element | null = null;
  private sequence = 0;
  private showTimer = 0;
  private hideTimer = 0;
  private resolver = new PreviewResolver();
  private abort = new AbortController();
  constructor(
    private annotations: Annotations,
    private url: string
  ) {
    this.host.id = 'skill-hunter-previews';
    const style = document.createElement('style');
    style.textContent = styles;
    this.card.className = 'card';
    this.card.hidden = true;
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-label', 'Legal reference preview');
    this.shadow.append(style, this.card);
    document.body.append(this.host);
    const options = { signal: this.abort.signal };
    document.addEventListener('pointerover', this.over, options);
    document.addEventListener('pointerout', this.out, options);
    document.addEventListener('focusin', this.focus, options);
    document.addEventListener('focusout', this.out, options);
    document.addEventListener('keydown', this.key, options);
    document.addEventListener('click', this.click, options);
    document.addEventListener('scroll', this.dismissOnScroll, {
      ...options,
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', this.dismissOnScroll, options);
    this.card.addEventListener('pointerenter', () => window.clearTimeout(this.hideTimer), options);
    this.card.addEventListener('pointerleave', () => this.scheduleHide(), options);
    this.card.addEventListener('focusin', () => window.clearTimeout(this.hideTimer), options);
    this.card.addEventListener(
      'focusout',
      (event) => {
        if (!this.card.contains(event.relatedTarget as Node | null)) this.scheduleHide();
      },
      options
    );
    this.card.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          this.hide(true);
        }
      },
      options
    );
  }
  private target(event: Event): Element | null {
    return event.target instanceof Element ? event.target.closest(`[${ANNOTATION_ATTR}]`) : null;
  }
  private over = (event: PointerEvent): void => {
    const target = this.target(event);
    if (!target || !this.annotations.reference(target)) return;
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.showTimer);
    if (this.active?.getAttribute(ANNOTATION_ATTR) === target.getAttribute(ANNOTATION_ATTR)) return;
    this.showTimer = window.setTimeout(() => {
      void this.show(target);
    }, 250);
  };
  private focus = (event: FocusEvent): void => {
    const target = this.target(event);
    if (target) void this.show(target);
  };
  private out = (event: Event): void => {
    if (!this.target(event)) return;
    const related = (event as MouseEvent).relatedTarget;
    if (related === this.host || (related instanceof Node && this.card.contains(related))) return;
    window.clearTimeout(this.showTimer);
    this.scheduleHide();
  };
  private scheduleHide(): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), 220);
  }
  private key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !this.card.hidden) {
      event.preventDefault();
      this.hide(true);
      return;
    }
    const target = this.target(event);
    if (target && !target.closest('a[href]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      void this.show(target, true);
    }
    if (target && event.key === 'ArrowDown' && !this.card.hidden) {
      event.preventDefault();
      this.card.querySelector('button')?.focus();
    }
  };
  private click = (event: MouseEvent): void => {
    const target = this.target(event);
    if (target && !target.closest('a[href]')) {
      void this.show(target, true);
      return;
    }
    if (!target && !event.composedPath().includes(this.host)) this.hide();
  };
  private dismissOnScroll = (event: Event): void => {
    if (!event.composedPath().includes(this.host)) this.hide();
  };
  private async show(target: Element, focus = false): Promise<void> {
    const ref = this.annotations.reference(target);
    if (!ref || !target.isConnected) return;
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.showTimer);
    this.active = target;
    const sequence = ++this.sequence;
    this.render(
      { kind: 'Loading preview…', title: ref.label, text: 'Looking up the source.' },
      ref
    );
    this.position(target);
    if (focus) this.card.querySelector('button')?.focus();
    let preview: Preview;
    try {
      preview = await this.resolver.resolve(ref, this.url);
    } catch (error) {
      preview = unavailablePreview(ref, error);
    }
    if (sequence !== this.sequence || !target.isConnected) return;
    const hadFocus = !!this.shadow.activeElement;
    this.render(preview, ref);
    this.position(target);
    if (hadFocus) this.card.querySelector('button')?.focus();
  }
  private render(preview: Preview, ref: Reference): void {
    this.card.replaceChildren();
    this.card.hidden = false;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close preview');
    close.addEventListener('click', () => this.hide(true));
    const kind = document.createElement('div');
    kind.className = 'kind';
    kind.setAttribute('aria-live', 'polite');
    kind.textContent = preview.kind;
    const title = document.createElement('h2');
    title.textContent = preview.title;
    const text = document.createElement('p');
    text.textContent = preview.text;
    this.card.append(close, kind, title, text);
    if (preview.detail) {
      const detail = document.createElement('p');
      detail.className = 'detail';
      detail.textContent = preview.detail;
      this.card.append(detail);
    }
    if (preview.links?.length) {
      const list = document.createElement('ul');
      for (const item of preview.links) {
        const li = document.createElement('li');
        const a = this.link(item.url, item.title);
        if (a) li.append(a);
        if (item.detail) {
          const detail = document.createElement('span');
          detail.className = 'detail';
          detail.textContent = item.detail;
          li.append(detail);
        }
        list.append(li);
      }
      this.card.append(list);
    }
    const source = preview.url
      ? this.link(preview.url, ref.kind === 'citing' ? 'Open search results ↗' : 'Open source ↗')
      : null;
    if (source) {
      source.className = 'source';
      this.card.append(source);
    }
  }
  private link(value: string, label: string): HTMLAnchorElement | null {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return null;
      const a = document.createElement('a');
      a.href = url.href;
      a.textContent = label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      return a;
    } catch {
      return null;
    }
  }
  private position(target: Element): void {
    const rect = target.getBoundingClientRect();
    this.card.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - this.card.offsetWidth - 12))}px`;
    const below = rect.bottom + 8;
    this.card.style.top = `${Math.max(12, Math.min(below + this.card.offsetHeight <= window.innerHeight - 12 ? below : rect.top - this.card.offsetHeight - 8, window.innerHeight - this.card.offsetHeight - 12))}px`;
  }
  hide(returnFocus = false): void {
    window.clearTimeout(this.showTimer);
    window.clearTimeout(this.hideTimer);
    ++this.sequence;
    this.card.hidden = true;
    const target = this.active;
    this.active = null;
    if (returnFocus && target instanceof HTMLElement) {
      target.focus();
      // Focusing the trigger fires focusin; do not immediately reopen the card.
      ++this.sequence;
      this.active = null;
      this.card.hidden = true;
    }
  }
  destroy(): void {
    this.hide();
    this.abort.abort();
    this.resolver.clear();
    this.host.remove();
  }
}
