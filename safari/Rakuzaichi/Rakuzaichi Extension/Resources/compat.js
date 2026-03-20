var api = (typeof browser !== 'undefined') ? browser : chrome; // browser API shim for cross-browser compat
if (typeof module !== 'undefined') module.exports = api;
