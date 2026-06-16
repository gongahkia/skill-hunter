var OptionsWrappedStats = (function() {
  var STOP_WORDS = {
    a: true, an: true, and: true, are: true, as: true, at: true, be: true, by: true, chat: true, for: true, from: true,
    how: true, in: true, into: true, is: true, it: true, me: true, my: true, of: true, on: true, or: true, our: true,
    the: true, this: true, to: true, up: true, with: true, you: true, your: true
  };
  var PLATFORM_LABELS = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    deepseek: 'DeepSeek',
    grok: 'Grok',
    copilot: 'Copilot',
    mistral: 'Mistral',
    huggingchat: 'HuggingChat',
    poe: 'Poe',
    kimi: 'Kimi',
    qwen: 'Qwen Chat',
    chatglm: 'ChatGLM',
    doubao: 'Doubao',
    notebooklm: 'NotebookLM'
  };
  var CARD_FILL = '#ffffff';
  var BG_FILL = '#eef3f7';
  var INK = '#172232';
  var MUTED = '#5b6d80';
  var PRIMARY = '#0a7ca5';
  var SECONDARY = '#e6843f';

  function text(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback || '';
    return String(value);
  }

  function number(value) {
    value = Number(value || 0);
    return isFinite(value) ? value : 0;
  }

  function platformLabel(platform) {
    platform = text(platform, 'unknown');
    return PLATFORM_LABELS[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
  }

  function title(chat) {
    return text(chat && (chat.title || chat.chatTitle || chat.chatId), 'Untitled chat');
  }

  function parseTime(value) {
    if (!value) return 0;
    var time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function dayKey(value) {
    var time = parseTime(value);
    return time ? new Date(time).toISOString().slice(0, 10) : 'unknown';
  }

  function displayDay(key) {
    if (!key || key === 'unknown') return 'Unknown day';
    var date = new Date(key + 'T00:00:00.000Z');
    if (Number.isNaN(date.getTime())) return key;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function addCount(map, key, seed, patch) {
    key = text(key, 'unknown');
    if (!map[key]) map[key] = Object.assign({ key: key, count: 0 }, seed || {});
    map[key].count += number(patch && patch.count !== undefined ? patch.count : 1);
    Object.keys(patch || {}).forEach(function(name) {
      if (name === 'count') return;
      map[key][name] = number(map[key][name]) + number(patch[name]);
    });
    return map[key];
  }

  function addTopic(map, label, amount) {
    label = text(label).trim();
    if (!label) return;
    var normalized = label.toLowerCase().replace(/[^a-z0-9_ -]+/g, '').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.length < 3 || STOP_WORDS[normalized]) return;
    if (!map[normalized]) map[normalized] = { label: label.length <= 24 ? label : label.slice(0, 24), count: 0 };
    map[normalized].count += amount || 1;
  }

  function addWords(map, value, amount) {
    text(value).split(/[^A-Za-z0-9_]+/).forEach(function(word) {
      addTopic(map, word, amount || 1);
    });
  }

  function topRows(map, limit, mapper, compare) {
    return Object.keys(map).map(function(key) {
      return mapper ? mapper(map[key], key) : map[key];
    }).sort(compare || function(a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return text(a.label || a.key).localeCompare(text(b.label || b.key));
    }).slice(0, limit);
  }

  function summarize(chats, threads) {
    chats = Array.isArray(chats) ? chats : [];
    threads = Array.isArray(threads) ? threads : [];
    var platformMap = {};
    var dayMap = {};
    var topicMap = {};
    var longestChat = null;
    var totalMessages = 0;

    chats.forEach(function(chat) {
      var messageCount = number(chat && chat.messageCount);
      var platform = text(chat && chat.platform, 'unknown');
      var date = chat && (chat.lastUpdatedAt || chat.capturedAt || '');
      totalMessages += messageCount;
      addCount(platformMap, platform, { platform: platform, chats: 0, messages: 0 }, { chats: 1, messages: messageCount });
      addCount(dayMap, dayKey(date), { date: dayKey(date), chats: 0, messages: 0 }, { chats: 1, messages: messageCount });
      if (!longestChat || messageCount > number(longestChat.messageCount)) longestChat = chat;
      (Array.isArray(chat && chat.tags) ? chat.tags : []).forEach(function(tag) {
        addTopic(topicMap, tag, 4);
      });
      addWords(topicMap, title(chat), 1);
    });

    threads.forEach(function(thread) {
      if (!thread || thread.status === 'archived') return;
      addTopic(topicMap, thread.tag, 3);
      addWords(topicMap, thread.text, 1);
    });

    var platformRows = topRows(platformMap, 1, function(row) {
      return {
        platform: row.platform,
        label: platformLabel(row.platform),
        chats: row.chats,
        messages: row.messages,
        count: row.messages || row.chats
      };
    }, function(a, b) {
      if (b.messages !== a.messages) return b.messages - a.messages;
      if (b.chats !== a.chats) return b.chats - a.chats;
      return a.label.localeCompare(b.label);
    });

    var dayRows = topRows(dayMap, 1, function(row) {
      return {
        date: row.date,
        label: displayDay(row.date),
        chats: row.chats,
        messages: row.messages,
        count: row.chats
      };
    }, function(a, b) {
      if (b.chats !== a.chats) return b.chats - a.chats;
      if (b.messages !== a.messages) return b.messages - a.messages;
      return text(b.date).localeCompare(text(a.date));
    });

    return {
      generatedAt: new Date().toISOString(),
      totalChats: chats.length,
      totalMessages: totalMessages,
      mostActivePlatform: platformRows[0] || null,
      busiestDay: dayRows[0] || null,
      longestChat: longestChat ? {
        chatId: longestChat.chatId || '',
        title: title(longestChat),
        platform: longestChat.platform || 'unknown',
        messageCount: number(longestChat.messageCount)
      } : null,
      topTopics: topRows(topicMap, 6)
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function fillText(ctx, value, x, y, maxWidth) {
    ctx.fillText(text(value), x, y, maxWidth);
  }

  function drawMetric(ctx, label, value, detail, x, y, width, height, accent) {
    ctx.fillStyle = CARD_FILL;
    roundedRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.fillStyle = accent || PRIMARY;
    ctx.fillRect(x, y, 8, height);
    ctx.fillStyle = MUTED;
    ctx.font = '700 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, label.toUpperCase(), x + 28, y + 38, width - 48);
    ctx.fillStyle = INK;
    ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, value, x + 28, y + 88, width - 48);
    ctx.fillStyle = MUTED;
    ctx.font = '500 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, detail, x + 28, y + 126, width - 48);
  }

  function drawPng(canvas, summary) {
    summary = summary || summarize();
    canvas.width = 1200;
    canvas.height = 630;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D API is unavailable');

    ctx.fillStyle = BG_FILL;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = INK;
    ctx.font = '800 54px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, 'Rakuzaichi Vault Wrapped', 64, 86, 900);
    ctx.fillStyle = MUTED;
    ctx.font = '500 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, number(summary.totalChats).toLocaleString() + ' chats / ' + number(summary.totalMessages).toLocaleString() + ' messages', 66, 126, 900);

    var platform = summary.mostActivePlatform || {};
    var day = summary.busiestDay || {};
    var longest = summary.longestChat || {};
    drawMetric(ctx, 'Most active', text(platform.label, 'None'), number(platform.messages).toLocaleString() + ' messages', 64, 170, 330, 150, PRIMARY);
    drawMetric(ctx, 'Busiest day', text(day.label, 'None'), number(day.chats).toLocaleString() + ' chats', 435, 170, 330, 150, SECONDARY);
    drawMetric(ctx, 'Longest chat', text(longest.title, 'None'), number(longest.messageCount).toLocaleString() + ' messages', 806, 170, 330, 150, PRIMARY);

    ctx.fillStyle = CARD_FILL;
    roundedRect(ctx, 64, 360, 1072, 190, 8);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    fillText(ctx, 'TOP TOPICS', 96, 404, 1000);
    ctx.font = '700 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    (summary.topTopics || []).slice(0, 6).forEach(function(topic, index) {
      var x = 96 + (index % 3) * 330;
      var y = 456 + Math.floor(index / 3) * 52;
      ctx.fillStyle = index % 2 ? SECONDARY : PRIMARY;
      roundedRect(ctx, x, y - 30, 270, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      fillText(ctx, text(topic.label, 'topic') + ' ' + number(topic.count).toLocaleString(), x + 16, y, 238);
    });
    return canvas;
  }

  function dataUrlToBlob(dataUrl, win) {
    var parts = String(dataUrl || '').split(',');
    var binary = (win && win.atob ? win.atob(parts[1] || '') : atob(parts[1] || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  function toPngBlob(summary, options) {
    options = options || {};
    var doc = options.document || document;
    var win = options.window || doc.defaultView || window;
    var canvas = drawPng(doc.createElement('canvas'), summary);
    return new Promise(function(resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function(blob) {
          if (blob) resolve(blob);
          else reject(new Error('PNG render failed'));
        }, 'image/png');
        return;
      }
      if (!canvas.toDataURL) {
        reject(new Error('PNG render API is unavailable'));
        return;
      }
      resolve(dataUrlToBlob(canvas.toDataURL('image/png'), win));
    });
  }

  return {
    summarize: summarize,
    toPngBlob: toPngBlob,
    drawPng: drawPng,
    platformLabel: platformLabel,
    displayDay: displayDay
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsWrappedStats;
