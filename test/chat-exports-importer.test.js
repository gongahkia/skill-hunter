import { describe, expect, it } from 'vitest';
import { loadFixture, loadSrc } from './helpers.js';

function loadBundle() {
  const module = { exports: {} };
  const code = [
    loadSrc('zip.js'),
    loadSrc('imports/run-metadata.js'),
    loadSrc('imports/session.js'),
    loadSrc('imports/normalizer.js'),
    loadSrc('imports/dedupe.js'),
    loadSrc('threads/scanner.js'),
    loadSrc('imports/chat-exports.js')
  ].join('\n');
  const fn = new Function('module', 'exports', code + '\nreturn { importer: ChatExportImporter, dedupe: ImportDedupe, zip: ZipWriter };');
  return fn(module, module.exports);
}

function fixture(path) {
  return loadFixture('fixtures/imports/' + path);
}

function slackEntries(extra = {}) {
  return Object.assign({
    'manifest.json': fixture('slack/manifest.json'),
    'channels.json': fixture('slack/channels.json'),
    'users.json': fixture('slack/users.json'),
    'general/2026-06-18.json': fixture('slack/general/2026-06-18.json'),
    'malformed/2026-06-18.json': fixture('slack/malformed/2026-06-18.json')
  }, extra);
}

function discordEntries(extra = {}) {
  return Object.assign({
    'package.json': fixture('discord/package.json'),
    'messages/index.json': fixture('discord/messages/index.json'),
    'messages/c100/channel.json': fixture('discord/messages/c100/channel.json'),
    'messages/c100/messages.json': fixture('discord/messages/c100/messages.json'),
    'messages/c200/channel.json': fixture('discord/messages/c200/channel.json'),
    'messages/c200/messages.json': fixture('discord/messages/c200/messages.json'),
    'messages/c300/channel.json': fixture('discord/messages/c300/channel.json'),
    'messages/c300/messages.json': fixture('discord/messages/c300/messages.json'),
    'servers/current.json': fixture('discord/servers/current.json'),
    'servers/recent.json': fixture('discord/servers/recent.json'),
    'malformed/messages.json': fixture('discord/malformed/messages.json')
  }, extra);
}

function zipBlob(zip, entries) {
  return zip.create(Object.keys(entries).map((name) => ({ name, content: entries[name] })));
}

function exportFile(path, content) {
  return {
    name: path.split('/').pop(),
    webkitRelativePath: path,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer
  };
}

function folderFiles(root, entries) {
  return Object.keys(entries).map((name) => exportFile(root + '/' + name, entries[name]));
}

function captureDao() {
  const writes = { chats: [], messages: [], threads: [], runs: [] };
  return {
    writes,
    dao: {
      putChat: async (chat) => writes.chats.push(chat),
      putMessages: async (_chatId, messages) => writes.messages.push(...messages),
      putOpenThreads: async (threads) => writes.threads.push(...threads),
      putExtractionRun: async (run) => writes.runs.push(run)
    }
  };
}

function largeSlackMessages(count) {
  return JSON.stringify(Array.from({ length: count }, (_, index) => ({
    type: 'message',
    user: index % 2 ? 'U456' : 'U123',
    text: index === 0 ? 'TODO: large import first item' : 'Large import message ' + String(index),
    ts: '1781740' + String(800 + index).padStart(3, '0') + '.000100'
  })));
}

describe('ChatExportImporter', () => {
  it('imports a Slack ZIP with provenance, file refs, scanner output, and recoverable malformed entries', async () => {
    const { importer, zip } = loadBundle();
    const { dao, writes } = captureDao();
    const result = await importer.importSlack({
      zipFile: zipBlob(zip, slackEntries()),
      sourcePath: 'slack-fixture.zip',
      sourceName: 'slack-fixture.zip',
      dao,
      importedAt: '2026-06-18T12:00:00.000Z'
    });

    expect(result.chats).toHaveLength(1);
    expect(result.messages).toHaveLength(4);
    expect(result.chat).toMatchObject({
      platform: 'slack',
      title: 'Slack / Fixture Workspace / #general',
      messageCount: 4
    });
    expect(result.chat.metadata.provenance).toMatchObject({
      workspaceId: 'T123',
      workspaceName: 'Fixture Workspace',
      channelId: 'C123',
      channelName: 'general'
    });
    expect(result.chat.metadata.provenance.userMap.U123).toMatchObject({ name: 'Alice' });
    expect(result.messages[0].metadata.provenance).toMatchObject({
      workspaceId: 'T123',
      channelId: 'C123',
      threadTs: '1781740800.000100',
      messageTs: '1781740800.000100',
      userId: 'U123',
      userName: 'Alice',
      sourceEntryPath: 'general/2026-06-18.json'
    });
    expect(result.messages.map((message) => message.content)).toEqual(expect.arrayContaining([
      'TODO: publish launch checklist',
      'Launch deck\n[file: launch.pdf]'
    ]));
    expect(result.messages.find((message) => message.content.includes('launch.pdf')).metadata.provenance.files[0]).toMatchObject({
      name: 'launch.pdf',
      url: 'https://fixture.slack.com/files/U123/F123/launch.pdf'
    });
    expect(result.openThreads).toHaveLength(1);
    expect(result.openThreads[0]).toMatchObject({ tag: 'TODO', text: 'publish launch checklist' });
    expect(result.run.metadata).toMatchObject({
      adapterId: 'slack',
      packageHash: result.chat.metadata.import.packageHash,
      chatIds: [result.chat.chatId],
      messageCount: 4,
      threadCount: 1
    });
    expect(result.run.metadata.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining(['SLACK_MALFORMED_JSON', 'SLACK_EXPORT_SCOPE_MISSING']));
    expect(writes.chats).toHaveLength(1);
    expect(writes.messages).toHaveLength(4);
    expect(writes.threads).toHaveLength(1);
    expect(writes.runs).toHaveLength(1);
  });

  it('imports a Discord extracted folder with DM, group DM, server, attachment, and deleted-user provenance', async () => {
    const { importer } = loadBundle();
    const result = await importer.importDiscord({
      files: folderFiles('DiscordDataPackage', discordEntries()),
      importedAt: '2026-06-18T12:05:00.000Z'
    });

    expect(result.chats.map((chat) => chat.title)).toEqual([
      'Discord / DM / Alice',
      'Discord / Group DM / Launch Group',
      'Discord / Current Fixture Server / #release'
    ]);
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map((message) => message.content)).toEqual(expect.arrayContaining([
      'TODO: send DM summary',
      'Group note with attachment\n[attachment: plan.png]',
      'REF: deleted user context'
    ]));
    expect(result.messages.find((message) => message.content.includes('plan.png')).metadata.provenance).toMatchObject({
      channelId: '200',
      channelType: 'group_dm',
      attachmentUrls: ['https://cdn.discordapp.com/attachments/200/att-1/plan.png'],
      attachmentFilenames: ['plan.png']
    });
    expect(result.messages.find((message) => message.content === 'REF: deleted user context').metadata.provenance).toMatchObject({
      serverId: '700',
      serverName: 'Current Fixture Server',
      channelId: '300',
      channelName: 'release',
      authorId: '9004',
      authorName: 'Deleted User',
      authorDeleted: true
    });
    expect(result.openThreads.map((thread) => thread.tag)).toEqual(['TODO', 'REF']);
    expect(result.run.metadata).toMatchObject({
      adapterId: 'discord',
      messageCount: 3,
      threadCount: 2
    });
    expect(result.run.metadata.chatIds).toHaveLength(3);
    expect(result.chats[0].metadata.import.source).toMatchObject({
      kind: 'folder',
      path: 'DiscordDataPackage',
      name: 'DiscordDataPackage'
    });
  });

  it('supports source dedupe decisions for imported chat exports', async () => {
    const { importer, dedupe, zip } = loadBundle();
    const result = await importer.importSlack({
      zipFile: zipBlob(zip, slackEntries()),
      sourcePath: 'slack-fixture.zip',
      sourceName: 'slack-fixture.zip',
      importedAt: '2026-06-18T12:10:00.000Z'
    });

    expect(dedupe.decide([result.chat], {
      adapterId: 'slack',
      sourceKind: 'zip',
      sourceObjectId: 'T123:C123',
      sourcePath: 'slack-fixture.zip',
      packageHash: result.chat.metadata.import.packageHash
    }).action).toBe('skip');
    expect(dedupe.decide([result.chat], {
      adapterId: 'slack',
      sourceKind: 'zip',
      sourceObjectId: 'T123:C123',
      sourcePath: 'slack-fixture.zip',
      packageHash: 'changed'
    }).action).toBe('update');
  });

  it('records cancellation during large Slack imports', async () => {
    const { importer, zip } = loadBundle();
    const controller = new AbortController();
    const result = await importer.importSlack({
      zipFile: zipBlob(zip, slackEntries({ 'general/2026-06-19.json': largeSlackMessages(160) })),
      sourcePath: 'large-slack.zip',
      signal: controller.signal,
      importedAt: '2026-06-18T12:15:00.000Z',
      onProgress: (event) => {
        if (event.itemCounts.parsed === 10) controller.abort();
      }
    });

    expect(result.cancelled).toBe(true);
    expect(result.run.metadata.status).toBe('cancelled');
    expect(result.run.metadata.partial.recoverable).toBe(true);
    expect(result.run.metadata.itemCounts.imported).toBeLessThan(164);
  });
});
