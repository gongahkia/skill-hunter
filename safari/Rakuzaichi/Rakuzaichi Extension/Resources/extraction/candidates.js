var ExtractionCandidateFilter = (function() {
  var DEFAULT_CONTEXT_RADIUS = 1;
  var QUESTION_PATTERN = /\?\s*(?:["')\]]*)$/;
  var OFFER_PATTERN = /\b(?:let me know|would you like|happy to|i can also|want me to)\b/i;
  var HEDGE_PATTERN = /\b(?:i(?:'|\u2019)m not sure|i am not sure|depends on|might be)\b/i;

  function text(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function messageId(message, index) {
    return text(message && (message.messageId || message.id)) || ('msg-' + index);
  }

  function role(message) {
    return text(message && message.role || 'unknown').toLowerCase();
  }

  function isAssistantRole(value) {
    return ['assistant', 'ai', 'bot', 'model'].indexOf(text(value).toLowerCase()) !== -1;
  }

  function normalizeContextRadius(value) {
    return typeof value === 'number' && isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_CONTEXT_RADIUS;
  }

  function splitSentences(value) {
    var rows = [];
    text(value).split(/\r?\n/).forEach(function(line) {
      line = line.replace(/\s+/g, ' ').trim();
      if (!line) return;
      var pattern = /[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g;
      var match;
      while ((match = pattern.exec(line))) {
        var sentence = match[0].trim();
        if (sentence) rows.push(sentence);
      }
    });
    return rows;
  }

  function sentenceReasons(sentence, roleValue) {
    var reasons = [];
    if (QUESTION_PATTERN.test(sentence)) reasons.push('question');
    if (isAssistantRole(roleValue) && OFFER_PATTERN.test(sentence)) reasons.push('offer');
    if (HEDGE_PATTERN.test(sentence)) reasons.push('hedge');
    return reasons;
  }

  function findCandidateSentences(messages) {
    var rows = [];
    (Array.isArray(messages) ? messages : []).forEach(function(message, messageIndex) {
      var id = messageId(message, messageIndex);
      var roleValue = role(message);
      splitSentences(message && message.content).forEach(function(sentence, sentenceIndex) {
        var reasons = sentenceReasons(sentence, roleValue);
        if (!reasons.length) return;
        rows.push({
          messageId: id,
          messageIndex: messageIndex,
          sentenceIndex: sentenceIndex,
          role: roleValue,
          text: sentence,
          reasons: reasons
        });
      });
    });
    return rows;
  }

  function groupByMessageIndex(candidates) {
    return candidates.reduce(function(groups, candidate) {
      var key = String(candidate.messageIndex);
      if (!groups[key]) groups[key] = [];
      groups[key].push(candidate);
      return groups;
    }, {});
  }

  function mergeRanges(ranges) {
    ranges.sort(function(a, b) {
      return a.startIndex - b.startIndex || a.endIndex - b.endIndex;
    });
    return ranges.reduce(function(merged, range) {
      var last = merged[merged.length - 1];
      if (last && range.startIndex <= last.endIndex + 1) {
        last.endIndex = Math.max(last.endIndex, range.endIndex);
        return merged;
      }
      merged.push({
        startIndex: range.startIndex,
        endIndex: range.endIndex
      });
      return merged;
    }, []);
  }

  function normalizeWindowMessage(message, index, candidates) {
    message = message || {};
    candidates = candidates || [];
    var id = messageId(message, index);
    var candidateText = candidates.map(function(candidate) {
      return candidate.text;
    }).join(' ');
    return Object.assign({}, message, {
      id: text(message.id || id),
      messageId: id,
      index: typeof message.index === 'number' ? message.index : index,
      role: role(message),
      content: candidateText || text(message.content).replace(/\s+/g, ' ').trim(),
      metadata: Object.assign({}, message.metadata || {}, candidates.length ? {
        extractionCandidate: {
          reasons: candidates.reduce(function(reasons, candidate) {
            candidate.reasons.forEach(function(reason) {
              if (reasons.indexOf(reason) === -1) reasons.push(reason);
            });
            return reasons;
          }, []),
          sentenceCount: candidates.length
        }
      } : {})
    });
  }

  function buildCandidateWindows(messages, options) {
    options = options || {};
    messages = Array.isArray(messages) ? messages : [];
    var radius = normalizeContextRadius(options.contextRadius);
    var candidates = findCandidateSentences(messages);
    if (!candidates.length) return [];

    var byIndex = groupByMessageIndex(candidates);
    var ranges = mergeRanges(Object.keys(byIndex).map(function(index) {
      index = Number(index);
      return {
        startIndex: Math.max(0, index - radius),
        endIndex: Math.min(messages.length - 1, index + radius)
      };
    }));

    return ranges.map(function(range) {
      var windowCandidates = candidates.filter(function(candidate) {
        return candidate.messageIndex >= range.startIndex && candidate.messageIndex <= range.endIndex;
      });
      var candidateIds = windowCandidates.reduce(function(ids, candidate) {
        if (ids.indexOf(candidate.messageId) === -1) ids.push(candidate.messageId);
        return ids;
      }, []);
      var windowMessages = [];
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        windowMessages.push(normalizeWindowMessage(messages[i], i, byIndex[String(i)]));
      }
      return {
        id: 'candidate-window:' + range.startIndex + '-' + range.endIndex,
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        candidateMessageIds: candidateIds,
        candidateCount: windowCandidates.length,
        candidates: windowCandidates,
        messages: windowMessages
      };
    });
  }

  function selectCandidateMessages(messages, options) {
    var seen = {};
    var rows = [];
    buildCandidateWindows(messages, options).forEach(function(window) {
      window.messages.forEach(function(message) {
        if (seen[message.messageId]) return;
        seen[message.messageId] = true;
        rows.push(message);
      });
    });
    return rows;
  }

  function buildExtractionPromptWindows(messages, options) {
    options = options || {};
    var promptBuilder = options.promptBuilder ||
      (typeof ExtractionPrompt !== 'undefined' && ExtractionPrompt.buildExtractionPrompt);
    if (typeof promptBuilder !== 'function') throw new Error('Extraction prompt builder is unavailable');
    return buildCandidateWindows(messages, options).map(function(window) {
      return Object.assign({}, window, {
        prompt: promptBuilder(window.messages, options.promptOptions || {})
      });
    });
  }

  return {
    DEFAULT_CONTEXT_RADIUS: DEFAULT_CONTEXT_RADIUS,
    QUESTION_PATTERN: QUESTION_PATTERN,
    OFFER_PATTERN: OFFER_PATTERN,
    HEDGE_PATTERN: HEDGE_PATTERN,
    splitSentences: splitSentences,
    findCandidateSentences: findCandidateSentences,
    buildCandidateWindows: buildCandidateWindows,
    selectCandidateMessages: selectCandidateMessages,
    buildExtractionPromptWindows: buildExtractionPromptWindows
  };
})();

if (typeof module !== 'undefined') module.exports = ExtractionCandidateFilter;
