/**
 * Tests for the citation graph DOM injection helpers.
 */

import {
  injectCitationPanels,
  renderCitationListItem,
  renderCitationPanelHTML,
} from '../citationGraphPanel';
import type { CitationEntry, CitationIndex } from '@/types';

describe('citationGraphPanel', () => {
  describe('renderCitationListItem', () => {
    it('escapes title/citation and wraps in anchor when url is present', () => {
      const entry: CitationEntry = {
        citation: '[2026] SGHC 47',
        title: 'A & B v <Other>',
        year: 2026,
        court: 'SGHC',
        url: 'https://elit/case',
        snippet: 'short snippet',
      };
      const html = renderCitationListItem(entry);
      expect(html).toContain('href="https://elit/case"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('A &amp; B v &lt;Other&gt;');
      expect(html).toContain('[2026] SGHC 47');
      expect(html).toContain('short snippet');
    });

    it('skips link wrapper when no url', () => {
      const entry: CitationEntry = {
        citation: '[2026] SGHC 47',
        title: 'A v B',
        year: 2026,
        court: 'SGHC',
        url: '',
        snippet: '',
      };
      expect(renderCitationListItem(entry)).not.toContain('<a ');
    });
  });

  describe('renderCitationPanelHTML', () => {
    it('renders a details panel with count and items', () => {
      const html = renderCitationPanelHTML('pr109-he-', [
        { citation: 'a', title: 'A', year: 2026, court: 'SGHC', url: '', snippet: '' },
        { citation: 'b', title: 'B', year: 2025, court: 'SGHC', url: '', snippet: '' },
      ]);
      expect(html).toContain('data-skill-hunter-citation-section="pr109-he-"');
      expect(html).toContain('class="skill-hunter-citation-panel"');
      expect(html).toContain('citation-summary-count">2<');
      expect(html).toContain('<ul class="citation-list">');
    });

    it('returns empty string when there are no entries', () => {
      expect(renderCitationPanelHTML('pr109-he-', [])).toBe('');
    });
  });

  describe('injectCitationPanels', () => {
    it('inserts a panel after each matching section header', () => {
      const container = document.createElement('div');
      container.innerHTML =
        '<h2 class="section-header" id="pr1-he-">1. Title</h2>' +
        '<div class="section-body">body 1</div>' +
        '<h2 class="section-header" id="pr2-he-">2. Title</h2>' +
        '<div class="section-body">body 2</div>';

      const index: CitationIndex = {
        actSlug: 'PC1871',
        actName: 'Penal Code',
        builtAt: '',
        sourceCorpusSize: 1,
        sections: {
          'pr1-he-': [{ citation: 'a', title: 'A', year: 2026, court: '', url: '', snippet: '' }],
        },
      };

      const decorated = injectCitationPanels(container, index);
      expect(decorated).toBe(1);
      const panels = container.querySelectorAll('.skill-hunter-citation-panel');
      expect(panels.length).toBe(1);
      const panel = panels[0] as HTMLElement;
      expect(panel.getAttribute('data-skill-hunter-citation-section')).toBe('pr1-he-');
      const previous = panel.previousElementSibling as HTMLElement;
      expect(previous.id).toBe('pr1-he-');
    });

    it('is a no-op when index is null', () => {
      const container = document.createElement('div');
      container.innerHTML = '<h2 class="section-header" id="pr1-he-">1</h2>';
      expect(injectCitationPanels(container, null)).toBe(0);
      expect(container.querySelector('.skill-hunter-citation-panel')).toBeNull();
    });
  });
});
