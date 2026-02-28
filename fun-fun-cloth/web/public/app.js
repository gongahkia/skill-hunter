function apiBase() {
  return document.querySelector("#apiBase").value.trim().replace(/\/$/, "");
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
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
  document.querySelector("#output").textContent =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

document.querySelector("#loadTemplatesBtn").addEventListener("click", async () => {
  try {
    const payload = await request("/templates");
    document.querySelector("#dslText").value = payload.policyDsl;
    document.querySelector("#contractText").value = payload.contractText;
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#compileBtn").addEventListener("click", async () => {
  try {
    const payload = await request("/compile", {
      method: "POST",
      body: {
        dsl: document.querySelector("#dslText").value
      }
    });
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#simulateBtn").addEventListener("click", async () => {
  try {
    const payload = await request("/simulate", {
      method: "POST",
      body: {
        dsl: document.querySelector("#dslText").value,
        contractText: document.querySelector("#contractText").value
      }
    });
    output(payload);
  } catch (error) {
    output(String(error));
  }
});
