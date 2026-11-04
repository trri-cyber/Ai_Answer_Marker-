const $ = id => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(action, payload = {}) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab.");
  return chrome.tabs.sendMessage(tab.id, { action, ...payload });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderQuestions(questions) {
  const section = $("questionsSection");
  const list = $("questionsList");
  if (!questions || !questions.length) {
    section.style.display = "none";
    list.innerHTML = "";
    return;
  }

  section.style.display = "block";
  list.innerHTML = questions
    .map(q => {
      const optionsHtml = (q.options || [])
        .map(
          opt => `<div style="font-size:12px; color:#475569; padding:2px 0;">• ${escapeHtml(opt)}</div>`
        )
        .join("");

      return `
      <div class="card" style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff;">
        <div style="font-weight:600; font-size:13px; color:#0f172a; margin-bottom:4px;">
          Q${q.number || ""}. ${escapeHtml(q.text || q.question || "")}
        </div>
        <div style="font-size:11px; color:#64748b; margin-bottom:6px; text-transform:uppercase;">
          ${(q.type || "mcq").replace(/_/g, " ")} (${(q.options || []).length} options)
        </div>
        ${optionsHtml ? `<div style="margin-bottom:8px; padding-left:4px;">${optionsHtml}</div>` : `<div style="font-size:11px; color:#94a3b8; font-style:italic;">No options detected</div>`}
        ${
          q.suggestion
            ? `
          <div style="margin-top:6px; padding:6px 8px; background:#f0fdf4; border-radius:6px; border:1px solid #bbf7d0;">
            <div style="font-size:12px; color:#166534; font-weight:600;">
              💡 Suggestion: ${escapeHtml(q.suggestion)}
            </div>
            ${q.explanation ? `<div style="font-size:11px; color:#475569; margin-top:2px;">${escapeHtml(q.explanation)}</div>` : ""}
            <button class="apply-single" data-id="${q.id}" data-answer="${escapeHtml(q.suggestion)}" style="margin-top:6px; background:#16a34a; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:600;">
              ✓ Apply Answer
            </button>
          </div>
        `
            : `
          <button class="suggest-single" data-id="${q.id}" style="margin-top:4px; background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:500;">
            💡 Get Suggestion
          </button>
        `
        }
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".apply-single").forEach(btn => {
    btn.onclick = async () => {
      const qid = btn.getAttribute("data-id");
      const answer = btn.getAttribute("data-answer");
      try {
        btn.disabled = true;
        btn.textContent = "Applying...";
        await send("AQ_APPLY_ANSWER", { id: qid, answer });
        btn.textContent = "✓ Applied";
        btn.style.background = "#64748b";
        await refresh();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Apply failed";
        $("message").textContent = err.message;
      }
    };
  });

  list.querySelectorAll(".suggest-single").forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "Thinking...";
      try {
        await send("AQ_SUGGEST_VISIBLE");
        await refresh();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Failed";
        $("message").textContent = err.message;
      }
    };
  });
}

async function refresh() {
  try {
    const tab = await activeTab();
    const result = await chrome.tabs.sendMessage(tab.id, { action: "AQ_GET_PROGRESS" });
    $("status").textContent = result?.isMoodle ? "Moodle detected" : "Not detected";
    const p = result?.progress || {};
    $("total").textContent = p.total || 0;
    $("answered").textContent = p.applied || 0;
    $("review").textContent = p.needsReview || 0;
    const pct = p.total ? Math.round((p.applied / p.total) * 100) : 0;
    $("progressBar").style.width = pct + "%";
    $("progressText").textContent = p.total
      ? `${pct}% applied · ${p.unanswered || 0} unanswered`
      : "Scan a Moodle quiz page to begin.";

    // Fetch and render question list
    if (result?.isMoodle) {
      const qRes = await chrome.tabs.sendMessage(tab.id, { action: "AQ_GET_QUESTIONS" });
      if (qRes?.questions) {
        renderQuestions(qRes.questions);
      }
    }
  } catch {
    $("status").textContent = "Open Moodle";
  }
}

$("scan").addEventListener("click", async () => {
  try {
    $("message").textContent = "Scanning Moodle page...";
    const r = await send("AQ_SCAN");
    $("message").textContent = r.message || `Detected ${r.questions?.length || 0} questions.`;
    if (r.questions) renderQuestions(r.questions);
    await refresh();
  } catch (e) {
    $("message").textContent = "Could not scan this page. Open a Moodle quiz attempt first.";
  }
});

$("suggest").addEventListener("click", async () => {
  try {
    $("message").textContent = "Requesting suggestions from AI backend...";
    const r = await send("AQ_SUGGEST_VISIBLE");
    $("message").textContent = r.message || "Suggestions ready!";
    if (r.questions) renderQuestions(r.questions);
    await refresh();
  } catch (e) {
    $("message").textContent = e.message;
  }
});

$("applyAll").addEventListener("click", async () => {
  try {
    $("message").textContent = "Applying all available suggestions...";
    const r = await send("AQ_APPLY_ALL");
    $("message").textContent = `Applied ${r.appliedCount || 0} answer(s).`;
    await refresh();
  } catch (e) {
    $("message").textContent = e.message;
  }
});

$("reviewBtn").addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("ui/review.html") })
);
$("databaseBtn").addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("ui/dashboard.html") })
);
$("settingsBtn").addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("ui/settings.html") })
);

refresh();
