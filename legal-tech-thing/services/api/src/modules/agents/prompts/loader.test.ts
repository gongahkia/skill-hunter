import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadLocalizedAgentPromptTemplate,
  renderLocalizedAgentPromptTemplate
} from "./loader";

describe("prompt localization routing", () => {
  it("selects Spanish localized templates when available", async () => {
    const resolution = await loadLocalizedAgentPromptTemplate("risk-scanner", {
      language: "es"
    });

    assert.equal(resolution.language, "es");
    assert.match(resolution.template, /espanol/i);
  });

  it("falls back to English templates when a locale is unavailable", async () => {
    const resolution = await loadLocalizedAgentPromptTemplate("risk-scanner", {
      language: "fr-CA"
    });

    assert.equal(resolution.language, "en");
    assert.match(resolution.template, /legal risk scanner/i);
  });

  it("renders localized templates with context substitutions", async () => {
    const rendered = await renderLocalizedAgentPromptTemplate(
      "compliance",
      {
        contractLanguage: "es"
      },
      {
        language: "es-MX"
      }
    );

    assert.equal(rendered.language, "es");
    assert.match(rendered.prompt, /cumplimiento/i);
  });
});
