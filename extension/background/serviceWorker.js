chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ autoQuizInstalled: true }));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "AQ_OPEN_PAGE" || message?.type === "AQ_OPEN_PAGE") {
    const targetUrl = chrome.runtime.getURL(message.url || "ui/bank.html");
    chrome.tabs.create({ url: targetUrl });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "AQ_BACKEND_STATUS" || message?.action === "AQ_BACKEND_STATUS") {
    fetch("http://127.0.0.1:3030/api/health")
      .then(r => r.json())
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
