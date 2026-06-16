import { describe, expect, it } from 'vitest';
import { loadSrc } from './helpers.js';

function loadCandidates() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/candidates.js'));
  fn(module, module.exports);
  return module.exports;
}

function loadPromptedCandidates() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('extraction/prompt.js') + '\n' + loadSrc('extraction/candidates.js'));
  fn(module, module.exports);
  return module.exports;
}

function message(index, role, content) {
  return {
    messageId: 'm-' + index,
    role,
    content,
    index
  };
}

describe('ExtractionCandidateFilter', () => {
  it('finds question, assistant offer, and hedge candidate sentences', () => {
    const filter = loadCandidates();
    const rows = filter.findCandidateSentences([
      message(1, 'user', 'Thanks. Can we confirm the Safari fallback?'),
      message(2, 'assistant', 'I can also add a zip fallback if you want. That part is already done.'),
      message(3, 'assistant', 'I am not sure whether Poe keeps stable ids. The rest is fine.'),
      message(4, 'user', 'No action needed.')
    ]);

    expect(rows.map((row) => [row.messageId, row.text, row.reasons])).toEqual([
      ['m-1', 'Can we confirm the Safari fallback?', ['question']],
      ['m-2', 'I can also add a zip fallback if you want.', ['offer']],
      ['m-3', 'I am not sure whether Poe keeps stable ids.', ['hedge']]
    ]);
  });

  it('builds merged LLM prompt windows with only candidate sentences plus nearby context', () => {
    const filter = loadPromptedCandidates();
    const windows = filter.buildExtractionPromptWindows([
      message(0, 'user', 'Setup context.'),
      message(1, 'user', 'Can we verify sync support? This filler should be removed.'),
      message(2, 'assistant', 'Context answer.'),
      message(3, 'assistant', 'Would you like me to add a batch fallback too? More filler.'),
      message(4, 'user', 'Closing context.')
    ], { contextRadius: 1 });

    expect(windows).toHaveLength(1);
    expect(windows[0].candidateMessageIds).toEqual(['m-1', 'm-3']);
    expect(windows[0].messages.map((row) => row.messageId)).toEqual(['m-0', 'm-1', 'm-2', 'm-3', 'm-4']);
    expect(windows[0].messages[1].content).toBe('Can we verify sync support?');
    expect(windows[0].messages[3].content).toBe('Would you like me to add a batch fallback too?');
    expect(windows[0].prompt[1].content).toContain('"messageId":"m-1"');
    expect(windows[0].prompt[1].content).not.toContain('This filler should be removed');
  });

  it('keeps a 200-message candidate pass below 30 LLM calls with recall above 0.7', () => {
    const filter = loadCandidates();
    const messages = Array.from({ length: 200 }, (_, index) => message(index, index % 2 ? 'assistant' : 'user', 'Routine update ' + index + '.'));
    const labeled = [
      [8, 'user', 'Can we confirm whether Firefox direct sync exists?'],
      [19, 'assistant', 'I can also add keyboard shortcuts if you want.'],
      [37, 'assistant', 'I am not sure whether Poe exposes stable thread ids.'],
      [61, 'assistant', 'Let me know if you want the Safari packaging path too.'],
      [88, 'user', 'What happens if quota is exceeded?'],
      [113, 'assistant', 'This depends on the extension page storage quota.'],
      [129, 'assistant', 'Would you like me to wire this into batch export?'],
      [151, 'assistant', 'It might be blocked on the browser cache limit.'],
      [176, 'user', 'Can we revisit the fallback wording?'],
      [193, 'assistant', 'Happy to draft the launch copy next.']
    ];
    for (const [index, role, content] of labeled) messages[index] = message(index, role, content);

    const windows = filter.buildCandidateWindows(messages, { contextRadius: 1 });
    const covered = new Set(windows.flatMap((window) => window.candidateMessageIds));
    const recall = labeled.filter(([index]) => covered.has('m-' + index)).length / labeled.length;

    expect(messages).toHaveLength(200);
    expect(windows.length).toBeLessThan(30);
    expect(recall).toBeGreaterThanOrEqual(0.7);
  });
});
