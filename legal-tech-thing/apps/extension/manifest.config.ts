const manifest = {
  manifest_version: 3,
  name: "Legal Tech Companion",
  description: "Browser assistant for contract review workflows.",
  version: "0.0.0",
  action: {
    default_title: "Legal Tech Companion"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  permissions: ["storage", "activeTab", "scripting", "tabs"],
  host_permissions: ["<all_urls>"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ]
} satisfies chrome.runtime.ManifestV3;

export default manifest;
