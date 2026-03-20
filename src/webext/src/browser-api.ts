export const extensionBrowser = ((): any => {
  if (typeof browser !== 'undefined') {
    return browser;
  }

  if (typeof chrome !== 'undefined') {
    return chrome;
  }

  return {
    runtime: {
      onMessage: {
        addListener: () => undefined,
      },
    },
    storage: {
      local: undefined,
    },
  };
})();
