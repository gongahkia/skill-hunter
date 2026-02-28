import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseContractByMimeType } from "./parser-router";

describe("parseContractByMimeType", () => {
  it("routes HTML MIME types to the HTML parser", async () => {
    const parsed = await parseContractByMimeType(
      " text/HTML ",
      Buffer.from("<html><body><h1>Master Service Agreement</h1><p>Payment terms apply.</p></body></html>")
    );

    assert.equal(parsed.parser, "html");
    assert.match(parsed.text, /# Master Service Agreement/);
    assert.match(parsed.text, /Payment terms apply\./);
  });

  it("falls back text/* MIME types to plain text parsing", async () => {
    const parsed = await parseContractByMimeType("text/csv", Buffer.from("a,b\r\n1,2"));

    assert.equal(parsed.parser, "text");
    assert.equal(parsed.text, "a,b\n1,2");
  });

  it("falls back +json application MIME types to plain text parsing", async () => {
    const parsed = await parseContractByMimeType(
      "application/vnd.api+json",
      Buffer.from('{"agreement":"msa"}')
    );

    assert.equal(parsed.parser, "text");
    assert.equal(parsed.text, '{"agreement":"msa"}');
  });

  it("falls back +xml application MIME types to plain text parsing", async () => {
    const parsed = await parseContractByMimeType(
      "application/ld+xml",
      Buffer.from("<contract>nda</contract>")
    );

    assert.equal(parsed.parser, "text");
    assert.equal(parsed.text, "<contract>nda</contract>");
  });

  it("throws for unsupported binary MIME types", async () => {
    await assert.rejects(
      () => parseContractByMimeType("application/octet-stream", Buffer.from([1, 2, 3])),
      /UNSUPPORTED_MIME_TYPE:application\/octet-stream/
    );
  });
});
