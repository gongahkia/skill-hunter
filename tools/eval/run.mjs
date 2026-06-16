import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');
const labelsPath = resolve(__dirname, 'labels.json');
const TAGS = ['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT'];
const MIN_MACRO_F1 = 0.6;

function loadSource(filename) {
  return readFileSync(resolve(rootDir, 'src', filename), 'utf8');
}

function loadExtractor() {
  const context = {
    console,
    Date,
    Math,
    Promise,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    JSON,
    module: undefined
  };
  vm.createContext(context);
  [
    'extraction/prompt.js',
    'extraction/candidates.js',
    'extraction/chunks.js',
    'extraction/runner.js'
  ].forEach((filename) => {
    vm.runInContext(loadSource(filename), context, { filename });
  });
  return context.ExtractionRunner;
}

function transcriptFromPrompt(prompt) {
  const user = Array.isArray(prompt) ? prompt.find((message) => message.role === 'user') : null;
  const content = user ? String(user.content || '') : '';
  const marker = 'Transcript JSON:\n';
  const start = content.indexOf(marker);
  if (start === -1) return [];
  const after = content.slice(start + marker.length);
  const end = after.indexOf('\n\nUse a messageId');
  return JSON.parse((end === -1 ? after : after.slice(0, end)).trim());
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' url ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  const normalized = normalize(value);
  return normalized ? normalized.split(/\s+/) : [];
}

function tokenF1(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return 0;
  const counts = new Map();
  right.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
  let overlap = 0;
  left.forEach((token) => {
    const count = counts.get(token) || 0;
    if (!count) return;
    overlap++;
    counts.set(token, count - 1);
  });
  if (!overlap) return 0;
  const precision = overlap / left.length;
  const recall = overlap / right.length;
  return (2 * precision * recall) / (precision + recall);
}

function tagFor(content, role) {
  const value = String(content || '').toLowerCase();
  if (/\b(prompt|reusable prompt|act as)\b/.test(value)) return 'PROMPT';
  if (/\b(reference|guide|mdn|developer\.chrome|https?:\/\/|cite)\b/.test(value)) return 'REF';
  if (/\b(revisit|review|pricing|onboarding|after .*real|after .*regenerated)\b/.test(value)) return 'REV';
  if (/\b(sql|unsafe|wrong|not sure|mixing up|verify|correct)\b/.test(value)) return 'FIXME';
  if (role === 'assistant' && /\b(let me know|would you like|happy to|i can also|want me to)\b/.test(value)) return 'FOLLOWUP';
  if (/\b(update|replace|run|add|wire|draft|regenerate)\b/.test(value)) return 'TODO';
  return 'UNRESOLVED';
}

function textFor(tag, content) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim().replace(/\?$/, '.');
  if (tag === 'FOLLOWUP') return clean.replace(/^(I can also|Would you like me to|Happy to|Let me know if you want)\s*/i, 'Decide whether to ');
  if (tag === 'FIXME') return 'Verify ' + clean.replace(/^I am not sure\s*/i, '').replace(/^This might be wrong:\s*/i, '');
  if (tag === 'REV') return clean.replace(/^Can we\s+/i, '').replace(/^Can you\s+/i, '');
  if (tag === 'TODO') return clean.replace(/^Can you\s+/i, '').replace(/^Can we\s+/i, '');
  if (tag === 'REF') return 'Keep reference from: ' + clean;
  if (tag === 'PROMPT') return clean.replace(/^Can you\s+/i, '');
  return clean.replace(/^Can we\s+/i, '').replace(/^What happens if\s+/i, 'Clarify what happens if ');
}

async function heuristicGenerator(prompt) {
  const transcript = transcriptFromPrompt(prompt);
  const rows = transcript
    .filter((message) => message.content)
    .map((message) => {
      const tag = tagFor(message.content, message.role);
      return {
        tag,
        text: textFor(tag, message.content),
        messageId: message.messageId,
        confidence: 0.82
      };
    });
  return JSON.stringify(rows);
}

function labelKey(row) {
  return [row.tag, row.messageId].join('\n');
}

function scoreTag(labels, predictions, tag) {
  const gold = labels.filter((row) => row.tag === tag);
  const pred = predictions.filter((row) => row.tag === tag);
  const used = new Set();
  let tp = 0;
  const fpRows = [];

  pred.forEach((prediction) => {
    let matchIndex = -1;
    for (let i = 0; i < gold.length; i++) {
      if (used.has(i)) continue;
      if (labelKey(gold[i]) !== labelKey(prediction)) continue;
      if (tokenF1(gold[i].text, prediction.text) < 0.35) continue;
      matchIndex = i;
      break;
    }
    if (matchIndex === -1) {
      fpRows.push(prediction);
      return;
    }
    used.add(matchIndex);
    tp++;
  });

  const fn = gold.length - tp;
  const fp = fpRows.length;
  const precision = tp + fp ? tp / (tp + fp) : gold.length ? 0 : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tag, tp, fp, fn, precision, recall, f1 };
}

async function main() {
  const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
  const runner = loadExtractor();
  const predictions = [];
  const gold = [];

  for (const item of labels.chats) {
    const chat = item.chat;
    const messages = item.messages;
    item.labels.forEach((label) => gold.push({ ...label, chatId: chat.chatId }));
    const result = await runner.runChatExtraction(chat, messages, {
      generator: heuristicGenerator,
      modelName: 'eval-heuristic-generator',
      modelVersion: 'labels-v1'
    });
    result.threads.forEach((thread) => {
      predictions.push({
        chatId: chat.chatId,
        tag: thread.tag,
        messageId: thread.messageId,
        text: thread.text
      });
    });
  }

  const rows = TAGS.map((tag) => scoreTag(gold, predictions, tag));
  const macroF1 = rows.reduce((sum, row) => sum + row.f1, 0) / rows.length;
  console.log('backend=eval-heuristic-generator');
  console.log('tag\tprecision\trecall\tf1\ttp\tfp\tfn');
  rows.forEach((row) => {
    console.log([
      row.tag,
      row.precision.toFixed(3),
      row.recall.toFixed(3),
      row.f1.toFixed(3),
      row.tp,
      row.fp,
      row.fn
    ].join('\t'));
  });
  console.log('macro_f1=' + macroF1.toFixed(3));

  if (macroF1 < MIN_MACRO_F1) {
    console.error('macro F1 below gate: ' + macroF1.toFixed(3) + ' < ' + MIN_MACRO_F1.toFixed(3));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
