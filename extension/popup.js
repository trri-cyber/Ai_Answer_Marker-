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
    const response = await fetch(`${API}/health`);
    if (!response.ok) throw new Error("Server unavailable");
    connectionEl.textContent = "GPT server online";
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
    setStatus("Questions detected. Request suggestions one at a time.");
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
  kind.textContent = `Type: ${question.type.replaceAll("_", " ")}`;
  const button = document.createElement("button");
  button.textContent = "Get GPT suggestion";
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
      const response = await fetch(`${API}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(question)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      answer.textContent = data.answer;
      answer.hidden = false;
      apply.hidden = false;
      apply.dataset.answer = data.answer;
      setStatus(data.source === "local" ? "Found in your local answer bank." : "GPT suggestion ready. Verify it before applying.");
    } catch (error) {
      setStatus(`Answer request failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = "Get GPT suggestion";
    }
  });

  apply.addEventListener("click", async () => {
    const result = await chrome.tabs.sendMessage(activeTabId, {
      type: "APPLY_ANSWER",
      payload: { id: question.id, answer: apply.dataset.answer }
    });
    setStatus(result?.message || "Could not apply suggestion.");
  });

  card.append(title, kind, button, answer, apply);
  questionsEl.append(card);
}

scanButton.addEventListener("click", scanPage);
checkServer();