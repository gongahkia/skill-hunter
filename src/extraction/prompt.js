var ExtractionPrompt = (function() {
  var TAGS = ['FIXME', 'TODO', 'UNRESOLVED', 'FOLLOWUP', 'REV', 'REF', 'PROMPT'];
  var MAX_MESSAGE_CHARS = 1800;
  var FEW_SHOT_EXAMPLES = [
    { tag: 'FIXME', messageId: 'fx-1', role: 'assistant', input: 'The API returns HTTP 201 for failed validation.', text: 'Verify the API status-code claim; validation failures should not be described as HTTP 201.', confidence: 0.91 },
    { tag: 'FIXME', messageId: 'fx-2', role: 'user', input: 'That package name looks wrong; I think it was renamed last month.', text: 'Check the package rename before relying on the suggested dependency.', confidence: 0.88 },
    { tag: 'FIXME', messageId: 'fx-3', role: 'assistant', input: 'I might be mixing up Safari and Firefox support for showDirectoryPicker.', text: 'Verify browser support for showDirectoryPicker before documenting sync behavior.', confidence: 0.86 },
    { tag: 'FIXME', messageId: 'fx-4', role: 'user', input: 'This SQL example concatenates user input; do not ship that.', text: 'Replace the SQL example with a parameterized query.', confidence: 0.94 },
    { tag: 'TODO', messageId: 'td-1', role: 'assistant', input: 'Next, add a migration test for the new openThreads index.', text: 'Add a migration test for the new openThreads index.', confidence: 0.9 },
    { tag: 'TODO', messageId: 'td-2', role: 'user', input: 'After this works, update the README install section.', text: 'Update the README install section after the feature works.', confidence: 0.84 },
    { tag: 'TODO', messageId: 'td-3', role: 'assistant', input: 'You will need to regenerate the screenshots once the UI copy is final.', text: 'Regenerate screenshots after UI copy is final.', confidence: 0.87 },
    { tag: 'TODO', messageId: 'td-4', role: 'assistant', input: 'Before submitting, run the Firefox package command and save the source bundle.', text: 'Run the Firefox package command and save the source bundle before submission.', confidence: 0.89 },
    { tag: 'UNRESOLVED', messageId: 'ur-1', role: 'user', input: 'Do we know whether Poe exposes stable thread ids?', text: 'Determine whether Poe exposes stable thread ids.', confidence: 0.82 },
    { tag: 'UNRESOLVED', messageId: 'ur-2', role: 'assistant', input: 'It depends on whether the extension page can use the File System Access API.', text: 'Resolve whether extension pages can use File System Access API for this flow.', confidence: 0.8 },
    { tag: 'UNRESOLVED', messageId: 'ur-3', role: 'user', input: 'What happens if a pinned chat exceeds the quota limit?', text: 'Clarify quota behavior when pinned chats alone exceed the limit.', confidence: 0.86 },
    { tag: 'UNRESOLVED', messageId: 'ur-4', role: 'assistant', input: 'I am not sure if the model emits valid JSON reliably without a repair pass.', text: 'Verify whether the model emits valid JSON reliably without a repair pass.', confidence: 0.83 },
    { tag: 'FOLLOWUP', messageId: 'fu-1', role: 'assistant', input: 'I can also add keyboard shortcuts for this panel if you want.', text: 'Consider adding keyboard shortcuts for the panel.', confidence: 0.78 },
    { tag: 'FOLLOWUP', messageId: 'fu-2', role: 'assistant', input: 'Would you like me to wire this into the batch export flow too?', text: 'Decide whether to wire this into the batch export flow.', confidence: 0.81 },
    { tag: 'FOLLOWUP', messageId: 'fu-3', role: 'assistant', input: 'Happy to draft the launch copy next.', text: 'Decide whether to draft launch copy next.', confidence: 0.72 },
    { tag: 'FOLLOWUP', messageId: 'fu-4', role: 'assistant', input: 'Let me know if you want the same treatment for Safari.', text: 'Decide whether Safari needs the same implementation treatment.', confidence: 0.76 },
    { tag: 'REV', messageId: 'rv-1', role: 'user', input: 'Let us revisit the color palette after the dashboard is less empty.', text: 'Revisit the color palette after the dashboard has real data.', confidence: 0.75 },
    { tag: 'REV', messageId: 'rv-2', role: 'assistant', input: 'This trade-off is probably worth reviewing once M5 performance numbers are real.', text: 'Review this trade-off after M5 performance numbers are available.', confidence: 0.79 },
    { tag: 'REV', messageId: 'rv-3', role: 'user', input: 'Park the monetization question until we see traction.', text: 'Revisit monetization after traction is known.', confidence: 0.77 },
    { tag: 'REV', messageId: 'rv-4', role: 'assistant', input: 'Keep this as a revisit item for the launch checklist.', text: 'Revisit this item during launch-checklist work.', confidence: 0.73 },
    { tag: 'REF', messageId: 'rf-1', role: 'assistant', input: 'Chrome documents MV3 remote-hosted-code limits at developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code.', text: 'Keep Chrome MV3 remote-hosted-code docs as a reference.', confidence: 0.93 },
    { tag: 'REF', messageId: 'rf-2', role: 'assistant', input: 'MDN says showDirectoryPicker is not Baseline because some major browsers lack it.', text: 'Keep MDN showDirectoryPicker compatibility docs as a reference.', confidence: 0.9 },
    { tag: 'REF', messageId: 'rf-3', role: 'user', input: 'Use the Transformers.js dtype guide for the q4 notes.', text: 'Keep the Transformers.js dtype guide as a reference for q4 notes.', confidence: 0.88 },
    { tag: 'REF', messageId: 'rf-4', role: 'assistant', input: 'The Safari conversion docs are the source of truth for extension packaging.', text: 'Keep Safari extension conversion docs as a packaging reference.', confidence: 0.84 },
    { tag: 'PROMPT', messageId: 'pr-1', role: 'user', input: 'Draft a concise PR summary with risks, tests, and rollback steps.', text: 'Draft a concise PR summary with risks, tests, and rollback steps.', confidence: 0.92 },
    { tag: 'PROMPT', messageId: 'pr-2', role: 'user', input: 'Act as a skeptical reviewer and list only blocker bugs first.', text: 'Act as a skeptical reviewer and list only blocker bugs first.', confidence: 0.9 },
    { tag: 'PROMPT', messageId: 'pr-3', role: 'user', input: 'Convert these notes into a launch checklist with verification commands.', text: 'Convert notes into a launch checklist with verification commands.', confidence: 0.87 },
    { tag: 'PROMPT', messageId: 'pr-4', role: 'user', input: 'Summarize this thread into a handoff for another coding agent.', text: 'Summarize a thread into a handoff for another coding agent.', confidence: 0.86 }
  ];

  var EXTRACTION_SYSTEM_PROMPT = [
    'You extract open-thread candidates from AI chat transcripts.',
    'Return only a JSON array. Do not wrap it in markdown. Do not add prose.',
    'Each item must match exactly: {"tag":"TODO|FIXME|REV|REF|FOLLOWUP|UNRESOLVED|PROMPT","text":"string","messageId":"string","confidence":0.0}.',
    'Use only message ids from the transcript. Never output message ids from examples.',
    'Output objects only. Never output plain strings, id lists, nested output fields, placeholder text, or repeated partial JSON.',
    'Invalid outputs include ["messageId"], ["id1","id2"], and objects with any key other than tag, text, messageId, confidence.',
    'If no candidates exist, return []. Thanks, greetings, acknowledgements, and completed work are not candidates.',
    'Prefer implicit unresolved work; explicit tag prefixes are handled elsewhere.',
    'Use TODO for concrete next actions, FIXME for likely wrong or unsafe content, UNRESOLVED for unanswered questions or uncertainty, FOLLOWUP for assistant offers awaiting user decision, REV for revisit-later items, REF for references worth keeping, PROMPT for reusable prompts.',
    'Keep text concise and actionable. Do not invent tasks. Confidence must be between 0 and 1.'
  ].join('\n');

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function messageId(message, index) {
    return text(message && (message.messageId || message.id)) || ('msg-' + index);
  }

  function truncate(value, maxChars) {
    value = text(value).replace(/\s+/g, ' ').trim();
    if (value.length <= maxChars) return value;
    return value.slice(0, Math.max(0, maxChars - 3)).trimEnd() + '...';
  }

  function normalizeMessage(message, index, maxChars) {
    message = message || {};
    return {
      messageId: messageId(message, index),
      role: text(message.role || 'unknown'),
      content: truncate(message.content, maxChars)
    };
  }

  function exampleLine(example) {
    return [
      example.tag + ' example:',
      'messageId=' + example.messageId,
      'role=' + example.role,
      'content=' + JSON.stringify(example.input),
      '=>',
      JSON.stringify([{ tag: example.tag, text: example.text, messageId: example.messageId, confidence: example.confidence }])
    ].join(' ');
  }

  function negativeLine(id, role, content) {
    return ['NEGATIVE example:', 'messageId=' + id, 'role=' + role, 'content=' + JSON.stringify(content), '=> []'].join(' ');
  }

  function tagCounts(examples) {
    return examples.reduce(function(counts, example) {
      counts[example.tag] = (counts[example.tag] || 0) + 1;
      return counts;
    }, {});
  }

  function examplesBlock() {
    return FEW_SHOT_EXAMPLES.map(exampleLine).join('\n');
  }

  function buildUserPrompt(messages, options) {
    options = options || {};
    var maxChars = typeof options.maxMessageChars === 'number' ? Math.max(80, options.maxMessageChars) : MAX_MESSAGE_CHARS;
    var normalized = (Array.isArray(messages) ? messages : []).map(function(message, index) {
      return normalizeMessage(message, index, maxChars);
    });
    var shapeId = normalized[0] ? normalized[0].messageId : 'msg-0';
    return [
      'Few-shot examples, one JSON object per line:',
      examplesBlock(),
      '',
      'Negative examples that must return []:',
      negativeLine('neg-1', 'user', 'Thanks, that solves it.'),
      negativeLine('neg-2', 'assistant', 'You are welcome.'),
      negativeLine('neg-3', 'user', 'No action needed.'),
      '',
      'Transcript JSON:',
      JSON.stringify(normalized),
      '',
      'Use a messageId from Transcript JSON in each output object. Do not output example messageIds.',
      'Output shape reminder: [{"tag":"UNRESOLVED","text":"short actionable text","messageId":"' + shapeId + '","confidence":0.8}] or [].',
      '',
      'Return only the output JSON array for the transcript.'
    ].join('\n');
  }

  function buildExtractionPrompt(messages, options) {
    return [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(messages, options) }
    ];
  }

  function stripFence(value) {
    value = text(value).trim();
    var fence = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fence ? fence[1].trim() : value;
  }

  function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    value = stripFence(value);
    var start = value.indexOf('[');
    var end = value.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) throw new Error('Extraction output did not contain a JSON array');
    return JSON.parse(value.slice(start, end + 1));
  }

  function validateRow(row, index, options) {
    options = options || {};
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Extraction row ' + index + ' must be an object');
    var tag = text(row.tag).trim().toUpperCase();
    if (TAGS.indexOf(tag) === -1) throw new Error('Extraction row ' + index + ' has unsupported tag: ' + row.tag);
    var body = text(row.text).trim();
    if (!body) throw new Error('Extraction row ' + index + ' missing text');
    var id = text(row.messageId).trim();
    if (!id) throw new Error('Extraction row ' + index + ' missing messageId');
    if (options.allowedMessageIds && options.allowedMessageIds.indexOf(id) === -1) {
      throw new Error('Extraction row ' + index + ' references unknown messageId: ' + id);
    }
    var confidence = row.confidence;
    if (typeof confidence !== 'number' || !isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('Extraction row ' + index + ' confidence must be between 0 and 1');
    }
    return {
      tag: tag,
      text: body,
      messageId: id,
      confidence: confidence
    };
  }

  function parseExtractionOutput(value, options) {
    var rows = parseJsonArray(value);
    if (!Array.isArray(rows)) throw new Error('Extraction output must be a JSON array');
    return rows.map(function(row, index) {
      return validateRow(row, index, options);
    });
  }

  return {
    TAGS: TAGS.slice(),
    MAX_MESSAGE_CHARS: MAX_MESSAGE_CHARS,
    FEW_SHOT_EXAMPLES: FEW_SHOT_EXAMPLES.slice(),
    EXTRACTION_SYSTEM_PROMPT: EXTRACTION_SYSTEM_PROMPT,
    tagCounts: function() {
      return tagCounts(FEW_SHOT_EXAMPLES);
    },
    buildUserPrompt: buildUserPrompt,
    buildExtractionPrompt: buildExtractionPrompt,
    parseJsonArray: parseJsonArray,
    parseExtractionOutput: parseExtractionOutput
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionPrompt;
