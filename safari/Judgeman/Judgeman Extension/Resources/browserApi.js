(function attachBrowserApi(root) {
  root.browserApi = root.browser ?? root.chrome;
})(typeof globalThis !== "undefined" ? globalThis : window);
