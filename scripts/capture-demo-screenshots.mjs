import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const screenshotDir = path.join(repoRoot, "asset", "screenshots");

const screenshotFiles = {
  doubleFace: "skill-hunter-double-face-demo.png",
  convertHands: "skill-hunter-convert-hands-demo.png",
  orderStamp: "skill-hunter-order-stamp-demo.png",
  sunAndMoon: "skill-hunter-sun-and-moon-demo.png",
  funFunCloth: "skill-hunter-fun-fun-cloth-demo.png"
};

const baseViewport = { width: 1560, height: 980 };

const managedProcesses = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  // Keep stdout readable when multiple services are involved.
  process.stdout.write(`[capture] ${message}\n`);
}

function startProcess(options) {
  const proc = spawn(options.cmd, options.args, {
    cwd: options.cwd ?? repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(options.env ?? {})
    }
  });

  const name = options.name;
  proc.stdout.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      process.stdout.write(`[${name}] ${text}\n`);
    }
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString().trim();
    if (text) {
      process.stderr.write(`[${name}] ${text}\n`);
    }
  });

  proc.on("exit", (code, signal) => {
    if (code !== null) {
      process.stdout.write(`[${name}] exited with code ${code}\n`);
    } else {
      process.stdout.write(`[${name}] exited via signal ${signal}\n`);
    }
  });

  managedProcesses.push(proc);
  return proc;
}

async function stopProcess(proc) {
  if (!proc || proc.killed || proc.exitCode !== null) {
    return;
  }

  proc.kill("SIGTERM");
  const started = Date.now();

  while (proc.exitCode === null && Date.now() - started < 8_000) {
    await sleep(100);
  }

  if (proc.exitCode === null) {
    proc.kill("SIGKILL");
  }
}

async function stopAllProcesses() {
  for (const proc of [...managedProcesses].reverse()) {
    await stopProcess(proc);
  }
  managedProcesses.length = 0;
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Poll until available.
    }
    await sleep(300);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function resetState() {
  await writeFile(
    path.join(repoRoot, "convert-hands", "api", "data", "store.json"),
    JSON.stringify({ cases: [], evidence: [], findings: [], bundles: [] }, null, 2) + "\n",
    "utf8"
  );
  await rm(path.join(repoRoot, "convert-hands", "api", "data", "bundles"), {
    recursive: true,
    force: true
  });

  await writeFile(
    path.join(repoRoot, "sun-and-moon", "api", "data", "store.json"),
    JSON.stringify({ cases: [], events: [] }, null, 2) + "\n",
    "utf8"
  );
}

async function captureConvertHands(browser) {
  log("Capturing convert-hands...");
  const api = startProcess({
    name: "convert-hands-api",
    cmd: "pnpm",
    args: ["-C", "convert-hands/api", "exec", "tsx", "src/server.ts"]
  });
  const web = startProcess({
    name: "convert-hands-web",
    cmd: "node",
    args: ["server.mjs"],
    cwd: path.join(repoRoot, "convert-hands", "web")
  });

  try {
    await waitForHttp("http://127.0.0.1:4011/health");
    await waitForHttp("http://127.0.0.1:4171");

    const context = await browser.newContext({ viewport: baseViewport });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4171", { waitUntil: "networkidle" });

    await page.fill("#caseName", "Acme v. Northwind");
    await page.fill("#matterNumber", "2026-LIT-0042");
    await page.fill("#owner", "Lit Ops");
    await page.click("#createCaseBtn");
    await page.waitForFunction(() => document.querySelectorAll("#caseSelect option").length > 0);

    await page.fill("#evidenceTitle", "Invoice Thread");
    await page.fill("#evidenceSourceRef", "mailbox://acme-disputes/481");
    await page.fill("#evidenceCapturedAt", "2026-02-14T09:30:00.000Z");
    await page.fill(
      "#evidenceExcerpt",
      "Northwind confirms delivery terms but disputes payment due date in writing."
    );
    await page.fill(
      "#chainOfCustody",
      "Exported from mailbox by counsel\nSigned digest archived in DMS"
    );
    await page.click("#addEvidenceBtn");

    const evidenceId = await page.waitForFunction(() => {
      const text = document.querySelector("#output")?.textContent ?? "";
      try {
        const payload = JSON.parse(text);
        return payload?.evidence?.id ?? null;
      } catch {
        return null;
      }
    });
    const resolvedEvidenceId = await evidenceId.jsonValue();
    if (!resolvedEvidenceId) {
      throw new Error("Failed to obtain evidence id from convert-hands output");
    }

    await page.fill("#findingTitle", "Payment timeline contradiction");
    await page.fill(
      "#findingSummary",
      "Evidence indicates inconsistent delivery acceptance and payment denial chronology."
    );
    await page.selectOption("#findingSeverity", "high");
    await page.fill("#findingEvidenceIds", String(resolvedEvidenceId));
    await page.click("#addFindingBtn");

    await page.click("#generateBundleBtn");
    await page.waitForFunction(() => {
      const value = document.querySelector("#bundleId")?.value ?? "";
      return value.length > 0;
    });
    await page.click("#verifyBundleBtn");

    await page.waitForFunction(() => {
      const text = document.querySelector("#output")?.textContent ?? "";
      try {
        const payload = JSON.parse(text);
        return payload?.valid === true;
      } catch {
        return false;
      }
    });

    await page.evaluate(() => {
      document.querySelector("#output")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(250);

    await page.screenshot({
      path: path.join(screenshotDir, screenshotFiles.convertHands),
      fullPage: false
    });

    await context.close();
  } finally {
    await stopProcess(web);
    await stopProcess(api);
  }
}

async function captureSunAndMoon(browser) {
  log("Capturing sun-and-moon...");
  const api = startProcess({
    name: "sun-and-moon-api",
    cmd: "pnpm",
    args: ["-C", "sun-and-moon/api", "exec", "tsx", "src/server.ts"]
  });
  const web = startProcess({
    name: "sun-and-moon-web",
    cmd: "node",
    args: ["server.mjs"],
    cwd: path.join(repoRoot, "sun-and-moon", "web")
  });

  try {
    await waitForHttp("http://127.0.0.1:4013/health");
    await waitForHttp("http://127.0.0.1:4173");

    const context = await browser.newContext({ viewport: baseViewport });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

    await page.fill("#caseName", "Acme Termination Dispute");
    await page.fill("#jurisdiction", "Singapore");
    await page.fill("#owner", "Chronology Team");
    await page.click("#createCaseBtn");
    await page.waitForFunction(() => document.querySelectorAll("#caseSelect option").length > 0);

    const addEvent = async ({ eventType, title, description, eventDate, sourceRef, citation, tags }) => {
      await page.selectOption("#eventType", eventType);
      await page.fill("#eventTitle", title);
      await page.fill("#eventDescription", description);
      await page.fill("#eventDate", eventDate);
      await page.fill("#sourceRef", sourceRef);
      await page.fill("#citation", citation);
      await page.fill("#tags", tags);
      await page.click("#addEventBtn");
      await page.waitForTimeout(200);
    };

    await addEvent({
      eventType: "communication",
      title: "Notice of termination",
      description: "Vendor sends termination notice citing missed payment.",
      eventDate: "2026-01-10T09:00:00.000Z",
      sourceRef: "email://notice-201",
      citation: "Exhibit A",
      tags: "termination,payment-missed"
    });

    await addEvent({
      eventType: "communication",
      title: "Renewal confirmation",
      description: "Account manager confirms renewal in the same day follow-up.",
      eventDate: "2026-01-10T15:00:00.000Z",
      sourceRef: "email://renewal-207",
      citation: "Exhibit B",
      tags: "renewal,payment-received"
    });

    await addEvent({
      eventType: "hearing",
      title: "Pre-trial conference",
      description: "Court schedules pre-trial conference after dormant period.",
      eventDate: "2026-03-25T10:00:00.000Z",
      sourceRef: "court://ptc-88",
      citation: "Exhibit C",
      tags: "hearing"
    });

    await page.click("#loadChronologyBtn");
    await page.waitForFunction(() => {
      const text = document.querySelector("#output")?.textContent ?? "";
      try {
        const payload = JSON.parse(text);
        const chronology = payload?.chronology;
        return (
          Array.isArray(chronology?.conflicts) &&
          chronology.conflicts.length > 0 &&
          Array.isArray(chronology?.gaps) &&
          chronology.gaps.length > 0
        );
      } catch {
        return false;
      }
    });

    await page.evaluate(() => {
      document.querySelector("#output")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(screenshotDir, screenshotFiles.sunAndMoon),
      fullPage: false
    });

    await context.close();
  } finally {
    await stopProcess(web);
    await stopProcess(api);
  }
}

async function captureFunFunCloth(browser) {
  log("Capturing fun-fun-cloth...");
  const api = startProcess({
    name: "fun-fun-cloth-api",
    cmd: "pnpm",
    args: ["-C", "fun-fun-cloth/api", "exec", "tsx", "src/server.ts"]
  });
  const web = startProcess({
    name: "fun-fun-cloth-web",
    cmd: "node",
    args: ["server.mjs"],
    cwd: path.join(repoRoot, "fun-fun-cloth", "web")
  });

  try {
    await waitForHttp("http://127.0.0.1:4014/health");
    await waitForHttp("http://127.0.0.1:4174");

    const context = await browser.newContext({ viewport: { width: 1560, height: 1100 } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle" });

    await page.click("#loadTemplatesBtn");
    await page.click("#simulateBtn");

    await page.waitForFunction(() => {
      const text = document.querySelector("#output")?.textContent ?? "";
      try {
        const payload = JSON.parse(text);
        return (
          payload?.simulation &&
          Array.isArray(payload.simulation.violations) &&
          payload.simulation.violations.length > 0
        );
      } catch {
        return false;
      }
    });

    await page.evaluate(() => {
      document.querySelector("#output")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(screenshotDir, screenshotFiles.funFunCloth),
      fullPage: false
    });

    await context.close();
  } finally {
    await stopProcess(web);
    await stopProcess(api);
  }
}

function escapeHtml(raw) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function highlightFirst(text, token) {
  if (!token || token.trim().length < 4) {
    return escapeHtml(text);
  }
  const index = text.toLowerCase().indexOf(token.toLowerCase());
  if (index < 0) {
    return escapeHtml(text);
  }
  const head = escapeHtml(text.slice(0, index));
  const body = escapeHtml(text.slice(index, index + token.length));
  const tail = escapeHtml(text.slice(index + token.length));
  return `${head}<mark>${body}</mark>${tail}`;
}

async function captureOrderStamp(browser) {
  log("Capturing order-stamp...");
  const api = startProcess({
    name: "order-stamp-api",
    cmd: "pnpm",
    args: ["-C", "order-stamp/api", "exec", "tsx", "src/server.ts"]
  });

  try {
    await waitForHttp("http://127.0.0.1:4012/health");

    const policyText = [
      "These terms include binding arbitration and a class action waiver.",
      "The provider may modify these terms at any time without notice.",
      "The subscription automatically renews unless canceled."
    ].join("\n\n");

    const detectResponse = await fetch("http://127.0.0.1:4012/detect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: policyText,
        url: "https://demo.invalid/terms",
        maxFindings: 10
      })
    });

    if (!detectResponse.ok) {
      throw new Error(`order-stamp detect request failed: ${detectResponse.status}`);
    }

    const payload = await detectResponse.json();
    const report = payload.report;
    const firstMatch = report.findings[0]?.matchedText ?? "";
    const highlighted = highlightFirst(policyText, firstMatch);

    const findingsMarkup = report.findings
      .slice(0, 4)
      .map((finding) => {
        return `
          <li>
            <strong>${escapeHtml(finding.title)} [${escapeHtml(finding.severity)}]</strong>
            <p>${escapeHtml(finding.context)}</p>
          </li>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>order-stamp demo capture</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 24px; background: #f6f7fb; color: #111827; }
            h1 { margin: 0 0 12px; }
            .summary { margin: 0 0 16px; font-size: 18px; }
            .layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
            .panel { background: #fff; border: 1px solid #dbe2ea; border-radius: 12px; padding: 16px; }
            pre { white-space: pre-wrap; margin: 0; line-height: 1.45; font-size: 15px; }
            ul { margin: 0; padding-left: 18px; display: grid; gap: 12px; }
            li p { margin: 6px 0 0; color: #374151; font-size: 14px; }
            mark { background: #fde68a; border-bottom: 2px solid #f59e0b; padding: 0 2px; }
          </style>
        </head>
        <body>
          <h1>order-stamp</h1>
          <p class="summary">Risk ${report.riskScore}/100 (${report.verdict}) with ${report.findings.length} finding(s).</p>
          <div class="layout">
            <section class="panel">
              <h2>Analyzed Terms</h2>
              <pre>${highlighted}</pre>
            </section>
            <section class="panel">
              <h2>Top Findings</h2>
              <ul>${findingsMarkup}</ul>
            </section>
          </div>
        </body>
      </html>
    `;

    const context = await browser.newContext({ viewport: baseViewport });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(screenshotDir, screenshotFiles.orderStamp),
      fullPage: false
    });
    await context.close();
  } finally {
    await stopProcess(api);
  }
}

function mockDoubleFaceApiRoute(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();

  if (method === "GET" && url.pathname === "/contracts") {
    const now = "2026-03-01T10:00:00.000Z";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "contract-demo-1",
            title: "Master Service Agreement - Acme vs Northwind",
            sourceType: "UPLOAD",
            status: "READY",
            createdAt: now,
            updatedAt: now,
            lastReviewAt: now
          },
          {
            id: "contract-demo-2",
            title: "Data Processing Addendum",
            sourceType: "UPLOAD",
            status: "READY",
            createdAt: now,
            updatedAt: now,
            lastReviewAt: null
          }
        ]
      })
    });
  }

  if (method === "POST" && url.pathname === "/auth/refresh") {
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "UNAUTHORIZED" })
    });
  }

  return route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: "NOT_FOUND", path: url.pathname })
  });
}

async function captureDoubleFace(browser) {
  log("Capturing double-face...");
  const web = startProcess({
    name: "double-face-web",
    cmd: "pnpm",
    args: ["-C", "double-face/apps/web", "exec", "next", "dev", "-p", "4180", "-H", "127.0.0.1"]
  });

  try {
    await waitForHttp("http://127.0.0.1:4180");

    const context = await browser.newContext({ viewport: baseViewport });
    const page = await context.newPage();
    await page.route("http://localhost:4000/**", mockDoubleFaceApiRoute);
    await page.route("http://127.0.0.1:4000/**", mockDoubleFaceApiRoute);
    await page.goto("http://127.0.0.1:4180", { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr");
    await page.waitForTimeout(350);

    await page.screenshot({
      path: path.join(screenshotDir, screenshotFiles.doubleFace),
      fullPage: false
    });

    await context.close();
  } finally {
    await stopProcess(web);
  }
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  await resetState();

  const browser = await chromium.launch({ headless: true });

  try {
    await captureDoubleFace(browser);
    await captureConvertHands(browser);
    await captureOrderStamp(browser);
    await captureSunAndMoon(browser);
    await captureFunFunCloth(browser);
  } finally {
    await browser.close();
    await stopAllProcesses();
  }

  log("Demo screenshots generated:");
  for (const fileName of Object.values(screenshotFiles)) {
    log(`- asset/screenshots/${fileName}`);
  }
}

process.on("SIGINT", async () => {
  await stopAllProcesses();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await stopAllProcesses();
  process.exit(143);
});

main().catch(async (error) => {
  process.stderr.write(`[capture] Failed: ${String(error)}\n`);
  await stopAllProcesses();
  process.exit(1);
});
