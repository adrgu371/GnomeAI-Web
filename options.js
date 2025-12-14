// options.js

// 1. Funcția de Salvare
function saveOptions() {
  const model = document.getElementById('model').value.trim();
  const key = document.getElementById('key').value.trim();
  const status = document.getElementById('status');

  chrome.storage.local.set({
    ollama_model: model,
    brave_api_key: key
  }, () => {
    // Feedback vizual
    status.textContent = '✅ Setări salvate cu succes!';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });
}

// 2. Funcția de Încărcare (Când deschizi pagina)
function restoreOptions() {
  chrome.storage.local.get(
    { ollama_model: 'granite4:3b', brave_api_key: '' }, // Valori default
    (items) => {
      document.getElementById('model').value = items.ollama_model;
      document.getElementById('key').value = items.brave_api_key;
    }
  );
}

// 3. Event Listeners (Aici legăm funcțiile de HTML)
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
