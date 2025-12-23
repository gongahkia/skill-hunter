const DEFAULTS = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.0-flash'
};

async function loadSettings() {
  const saved = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('provider').value = saved.provider;
  document.getElementById('apiKey').value = saved.apiKey;
  document.getElementById('model').value = saved.model;
}

async function saveSettings() {
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value.trim() || DEFAULTS.model;
  await chrome.storage.sync.set({ provider, apiKey, model });
}

function setStatus(text) {
  const el = document.getElementById('status');
  el.textContent = text;
  if (!text) return;
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 2500);
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  try {
    await saveSettings();
    setStatus('Saved.');
  } catch (e) {
    setStatus('Save failed.');
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  try {
    await chrome.storage.sync.set({ apiKey: '' });
    document.getElementById('apiKey').value = '';
    setStatus('Cleared.');
  } catch (e) {
    setStatus('Clear failed.');
  }
});

loadSettings();
