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

async function refreshCases() {
  const payload = await request("/cases");
  const select = document.querySelector("#caseSelect");
  select.innerHTML = "";

  for (const item of payload.items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} (${item.jurisdiction})`;
    select.appendChild(option);
  }

  output(payload);
}

function selectedCaseId() {
  return document.querySelector("#caseSelect").value;
}

document.querySelector("#createCaseBtn").addEventListener("click", async () => {
  try {
    const payload = await request("/cases", {
      method: "POST",
      body: {
        name: document.querySelector("#caseName").value,
        jurisdiction: document.querySelector("#jurisdiction").value,
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

document.querySelector("#addEventBtn").addEventListener("click", async () => {
  try {
    const tags = document
      .querySelector("#tags")
      .value.split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = await request(`/cases/${selectedCaseId()}/events`, {
      method: "POST",
      body: {
        eventType: document.querySelector("#eventType").value,
        title: document.querySelector("#eventTitle").value,
        description: document.querySelector("#eventDescription").value,
        eventDate: document.querySelector("#eventDate").value,
        sourceRef: document.querySelector("#sourceRef").value,
        citation: document.querySelector("#citation").value || undefined,
        tags
      }
    });

    output(payload);
  } catch (error) {
    output(String(error));
  }
});

document.querySelector("#loadChronologyBtn").addEventListener("click", async () => {
  try {
    const payload = await request(`/cases/${selectedCaseId()}/chronology`);
    output(payload);
  } catch (error) {
    output(String(error));
  }
});

refreshCases().catch((error) => output(String(error)));
