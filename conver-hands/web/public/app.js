function getApiBase() {
  return document.querySelector("#apiBase").value.trim().replace(/\/$/, "");
}

async function request(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

function output(value) {
  const node = document.querySelector("#output");
  node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function selectedCaseId() {
  return document.querySelector("#caseSelect").value;
}

async function refreshCases() {
  const data = await request("/cases");
  const select = document.querySelector("#caseSelect");
  select.innerHTML = "";

  for (const item of data.items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} (${item.matterNumber})`;
    select.appendChild(option);
  }

  output(data);
}

document.querySelector("#createCaseBtn").addEventListener("click", async () => {
  try {
    const payload = await request("/cases", {
      method: "POST",
      body: {
        name: document.querySelector("#caseName").value,
        matterNumber: document.querySelector("#matterNumber").value,
        owner: document.querySelector("#owner").value
      }
    });
    await refreshCases();
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#refreshCasesBtn").addEventListener("click", async () => {
  try {
    await refreshCases();
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#addEvidenceBtn").addEventListener("click", async () => {
  try {
    const chainOfCustody = document
      .querySelector("#chainOfCustody")
      .value.split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = await request(`/cases/${selectedCaseId()}/evidence`, {
      method: "POST",
      body: {
        title: document.querySelector("#evidenceTitle").value,
        sourceType: document.querySelector("#evidenceSourceType").value,
        sourceRef: document.querySelector("#evidenceSourceRef").value,
        capturedAt: document.querySelector("#evidenceCapturedAt").value,
        excerpt: document.querySelector("#evidenceExcerpt").value,
        chainOfCustody
      }
    });
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#addFindingBtn").addEventListener("click", async () => {
  try {
    const evidenceIds = document
      .querySelector("#findingEvidenceIds")
      .value.split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = await request(`/cases/${selectedCaseId()}/findings`, {
      method: "POST",
      body: {
        title: document.querySelector("#findingTitle").value,
        summary: document.querySelector("#findingSummary").value,
        severity: document.querySelector("#findingSeverity").value,
        evidenceIds
      }
    });
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#generateBundleBtn").addEventListener("click", async () => {
  try {
    const payload = await request(`/cases/${selectedCaseId()}/bundles/generate`, {
      method: "POST",
      body: {
        requestedBy: document.querySelector("#requestedBy").value,
        includeDismissed: false
      }
    });
    document.querySelector("#bundleId").value = payload.bundle.id;
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#listBundlesBtn").addEventListener("click", async () => {
  try {
    output(await request(`/cases/${selectedCaseId()}/bundles`));
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#verifyBundleBtn").addEventListener("click", async () => {
  try {
    const bundleId = document.querySelector("#bundleId").value.trim();
    output(await request(`/bundles/${bundleId}/verify`, { method: "POST", body: {} }));
  } catch (error) {
    output(String(error));
  }
});

refreshCases().catch((error) => output(String(error)));
