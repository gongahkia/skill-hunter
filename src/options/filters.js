var OptionsFilters = (function() {
  var DAY_MS = 24 * 60 * 60 * 1000;

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function parseTime(value) {
    if (!value) return 0;
    var time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function startOfDay(time) {
    var date = new Date(time);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function endOfDay(time) {
    var date = new Date(time);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  function matchesDate(chat, state, now) {
    var preset = state.datePreset || 'all';
    if (preset === 'all') return true;
    var updated = parseTime(chat.lastUpdatedAt || chat.capturedAt);
    if (!updated) return false;
    now = now || Date.now();
    if (preset === 'today') return updated >= startOfDay(now);
    if (preset === 'week') return updated >= now - 7 * DAY_MS;
    if (preset === 'month') return updated >= now - 31 * DAY_MS;
    if (preset === 'custom') {
      var start = state.dateStart ? startOfDay(parseTime(state.dateStart)) : 0;
      var end = state.dateEnd ? endOfDay(parseTime(state.dateEnd)) : Infinity;
      return updated >= start && updated <= end;
    }
    return true;
  }

  function matchesTags(chat, tags) {
    if (!tags.length) return true;
    var chatTags = list(chat.tags);
    return tags.every(function(tag) {
      return chatTags.indexOf(tag) !== -1;
    });
  }

  function apply(chats, state, now) {
    state = state || {};
    var platforms = list(state.platforms);
    var tags = list(state.tags);
    return (Array.isArray(chats) ? chats : []).filter(function(chat) {
      if (platforms.length && platforms.indexOf(chat.platform) === -1) return false;
      if (state.pinnedOnly && !chat.pinned) return false;
      if (!matchesTags(chat, tags)) return false;
      return matchesDate(chat, state, now);
    });
  }

  return {
    apply: apply,
    matchesDate: matchesDate
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsFilters;
