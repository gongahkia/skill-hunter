(function attachLogger(root, factory) {
  const api = factory(root);
  root.JudgemanLogger = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function loggerFactory(root) {
  const GLOBAL_LOG_KEY = "__judgemanLogStore";
  const MAX_GLOBAL_ENTRIES = 600;

  function toSerializable(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return String(value);
    }
  }

  function normaliseError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack || ""
      };
    }

    if (typeof error === "string") {
      return {
        name: "Error",
        message: error,
        stack: ""
      };
    }

    return {
      name: "Error",
      message: String(error),
      stack: ""
    };
  }

  function getGlobalStore() {
    if (!Array.isArray(root[GLOBAL_LOG_KEY])) {
      root[GLOBAL_LOG_KEY] = [];
    }
    return root[GLOBAL_LOG_KEY];
  }

  function pushGlobalEntry(entry) {
    const store = getGlobalStore();
    store.push(entry);
    while (store.length > MAX_GLOBAL_ENTRIES) {
      store.shift();
    }
  }

  function createLogger(options = {}) {
    const namespace = String(options.namespace || "Judgeman");
    const maxEntries = Number(options.maxEntries || 200);
    const consoleRef = options.consoleRef || root.console;

    function buildEntry(level, event, details) {
      return {
        timestamp: new Date().toISOString(),
        namespace,
        level,
        event: String(event || "event"),
        details: toSerializable(details)
      };
    }

    function emitConsole(entry) {
      if (!consoleRef) return;
      const method = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";
      const fn = typeof consoleRef[method] === "function" ? consoleRef[method] : consoleRef.log;
      fn.call(consoleRef, `[${entry.namespace}] ${entry.event}`, entry.details || "");
    }

    function readNamespaceEntries() {
      return getGlobalStore().filter((entry) => entry.namespace === namespace);
    }

    function pruneNamespaceEntries() {
      const store = getGlobalStore();
      const namespaceEntries = [];
      const nonNamespaceEntries = [];

      for (const entry of store) {
        if (entry.namespace === namespace) {
          namespaceEntries.push(entry);
        } else {
          nonNamespaceEntries.push(entry);
        }
      }

      if (namespaceEntries.length <= maxEntries) {
        return;
      }

      const keptNamespaceEntries = namespaceEntries.slice(namespaceEntries.length - maxEntries);
      root[GLOBAL_LOG_KEY] = [...nonNamespaceEntries, ...keptNamespaceEntries];
    }

    function log(level, event, details) {
      const entry = buildEntry(level, event, details);
      pushGlobalEntry(entry);
      pruneNamespaceEntries();
      emitConsole(entry);
      return entry;
    }

    return {
      debug(event, details) {
        return log("debug", event, details);
      },
      info(event, details) {
        return log("info", event, details);
      },
      warn(event, details) {
        return log("warn", event, details);
      },
      error(event, error, details = {}) {
        return log("error", event, {
          ...toSerializable(details),
          error: normaliseError(error)
        });
      },
      entries() {
        return readNamespaceEntries();
      },
      exportText(extra = {}) {
        return JSON.stringify(
          {
            namespace,
            generatedAt: new Date().toISOString(),
            extra: toSerializable(extra),
            entries: readNamespaceEntries()
          },
          null,
          2
        );
      }
    };
  }

  function getLogs() {
    return getGlobalStore().slice();
  }

  return {
    createLogger,
    getLogs,
    normaliseError,
    toSerializable
  };
});
