const API = "http://localhost:3030";
const scanButton = document.getElementById("scan");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const questionsEl = document.getElementById("questions");
const connectionEl = document.getElementById("connection");

let activeTabId = null;
let detectedQuestions = [];

async function checkServer() {
  try {
    const response = await fetch(`${API}/api/health`).catch(() => fetch(`${API}/health`));
    if (!response.ok) throw new Error("Server unavailable");
    connectionEl.textContent = "AI server online";
  } catch {
    connectionEl.textContent = "Server offline";
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  activeTabId = tab.id;
  return tab;
}

async function scanPage() {
  scanButton.disabled = true;
  questionsEl.replaceChildren();
  setStatus("Scanning Moodle page…");
  try {
    const tab = await getActiveTab();
    const results = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_MOODLE" });
    if (!results?.isMoodle) {
      setStatus("Moodle quiz page not detected. Open a Moodle quiz attempt and try again.");
      return;
    }
    detectedQuestions = results.questions || [];
    countEl.textContent = String(detectedQuestions.length);
    if (!detectedQuestions.length) {
      setStatus("No questions found on this page.");
      return;
    }
    setStatus("Questions detected with options. Request suggestions below.");
    detectedQuestions.forEach(renderQuestion);
  } catch (error) {
    setStatus(`Could not scan this page: ${error.message}`);
  } finally {
    scanButton.disabled = false;
  }
}

function renderQuestion(question) {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "question";
  title.textContent = `${question.number}. ${question.question}`;

  const kind = document.createElement("div");
  kind.className = "kind";
  kind.textContent = `Type: ${(question.type || "mcq").replaceAll("_", " ")} (${(question.options || question.choices || []).length} options)`;

  const optsList = document.createElement("div");
  optsList.className = "options-list";
  optsList.style.cssText = "font-size:12px; color:#475569; margin:6px 0;";
  (question.options || question.choices || []).forEach(opt => {
    const item = document.createElement("div");
    item.textContent = `• ${opt}`;
    optsList.append(item);
  });

  const button = document.createElement("button");
  button.textContent = "Get AI suggestion";

  const answer = document.createElement("div");
  answer.className = "answer";
  answer.hidden = true;

  const apply = document.createElement("button");
  apply.className = "apply";
  apply.textContent = "Apply suggestion";
  apply.hidden = true;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Thinking…";
    try {
      const response = await fetch(`${API}/api/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question || question.text,
          questionType: question.type || question.questionType,
          options: question.options || question.choices
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      const ans = data.suggestedAnswer || data.answer;
      answer.textContent = `💡 ${ans}${data.explanation ? ` — ${data.explanation}` : ""}`;
      answer.hidden = false;
      apply.hidden = false;
      apply.dataset.answer = ans;
      setStatus(data.source === "local_verified" ? "Found in local verified bank." : "AI suggestion ready. Verify it before applying.");
    } catch (error) {
      setStatus(`Answer request failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "Get AI suggestion";
    }
  });

  apply.addEventListener("click", async () => {
    try {
      apply.disabled = true;
      const result = await chrome.tabs.sendMessage(activeTabId, {
        type: "APPLY_ANSWER",
        payload: { id: question.id, answer: apply.dataset.answer }
      });
      setStatus(result?.message || "Option applied.");
      apply.textContent = "✓ Applied";
    } catch (e) {
      setStatus(`Failed to apply: ${e.message}`);
      apply.disabled = false;
    }
  });

  card.append(title, kind, optsList, button, answer, apply);
  questionsEl.append(card);
}

scanButton.addEventListener("click", scanPage);
checkServer();
