import { describe, expect, it } from 'vitest';
import { loadFixture, loadSrc } from './helpers.js';

function loadLocalRAG() {
  const module = { exports: {} };
  const fn = new Function('module', 'exports', loadSrc('rag/local-rag.js'));
  fn(module, module.exports);
  return module.exports;
}

function loadEvalSet() {
  return JSON.parse(loadFixture('fixtures/rag/eval-set.json'));
}

function fakeEvalEmbedder() {
  return {
    async embed(texts) {
      return texts.map((value) => {
        const lower = String(value).toLowerCase();
        return [
          /restore|backup|snapshot|archive|recover/.test(lower) ? 1 : 0,
          /browser|worker|manifest|release/.test(lower) ? 1 : 0,
          /adapter|migration|imported|prose|provenance/.test(lower) ? 1 : 0,
          /stale|removed|deleted|disappear/.test(lower) ? 1 : 0,
          /encrypted|hash|package/.test(lower) ? 1 : 0
        ];
      });
    }
  };
}

function daoForFixture(fixture, omittedChatId) {
  return {
    listChats: async () => fixture.chats.filter((chat) => chat.chatId !== omittedChatId),
    listAllMessages: async () => fixture.messages.filter((message) => message.chatId !== omittedChatId)
  };
}

describe('LocalRAG eval fixture', () => {
  it('covers retrieval-only exact, semantic, stale, unsupported, and no-answer cases', async () => {
    const LocalRAG = loadLocalRAG();
    const fixture = loadEvalSet();

    expect(fixture.queries.map((query) => query.id)).toEqual([
      'exact-recall',
      'semantic-recall',
      'imported-prose-recall',
      'unsupported-question',
      'stale-deleted-source',
      'hallucination-check'
    ]);

    for (const query of fixture.queries) {
      const rag = LocalRAG.create({
        dao: daoForFixture(fixture, query.removeChatIdBeforeSearch),
        embedder: fakeEvalEmbedder()
      });
      const results = await rag.search(query.query, { limit: 5 });

      if (query.expectedTopMessageId) {
        expect(results[0].chunk.messageId, query.id).toBe(query.expectedTopMessageId);
      }
      if (query.expectedAnyMessageIds) {
        expect(results.some((result) => query.expectedAnyMessageIds.includes(result.chunk.messageId)), query.id).toBe(true);
      }
      if (query.expectedNone) {
        expect(results, query.id).toEqual([]);
      }
      if (query.expectedAbsentChatId) {
        expect(results.every((result) => result.chunk.chatId !== query.expectedAbsentChatId), query.id).toBe(true);
      }
      if (query.expectedNoAnswer) {
        expect(results.every((result) => !Object.prototype.hasOwnProperty.call(result, 'answer')), query.id).toBe(true);
      }
    }
  });
});
