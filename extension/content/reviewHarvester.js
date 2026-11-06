(function(g) {
  function clean(str) {
    if (!str) return "";
    return String(str)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractCorrectAnswer(qEl) {
    // 1. Check for Moodle's explicit .rightanswer block
    const rightAnswerEl = qEl.querySelector(".rightanswer, .feedback .rightanswer, .outcome .rightanswer");
    if (rightAnswerEl) {
      const text = clean(rightAnswerEl.textContent || "");
      const match = text.match(/The correct answer(?:s)? (?:is|are):?\s*['"]?(.+?)['"]?\.?$/i);
      if (match && match[1]) {
        return clean(match[1].replace(/^\s*['"]|['"]\s*$/g, ""));
      }
      const stripped = text.replace(/^.*The correct answer(?:s)? (?:is|are):?\s*/i, "").trim().replace(/\.$/, "");
      if (stripped) return stripped;
    }

    // 2. Check for option container marked with "correct"
    const correctRow = qEl.querySelector(".answer .r0.correct, .answer .r1.correct, .answer .correct, .answer [class*='correct']:not([class*='incorrect'])");
    if (correctRow) {
      const label = correctRow.querySelector("label") || correctRow;
      const clone = label.cloneNode(true);
      clone.querySelectorAll(".answernumber, .optionnumber, input, i, img, svg").forEach(n => n.remove());
      const choiceText = clean(clone.textContent || "");
      if (choiceText && !choiceText.toLowerCase().includes("clear my choice")) {
        return choiceText.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim() || choiceText;
      }
    }

    // 3. Check for checkmark icon (fa-check, text-success)
    const checkIcon = qEl.querySelector(".answer .fa-check, .answer .text-success, .answer img[alt*='Correct'], .answer [aria-label*='Correct']");
    if (checkIcon) {
      const parentRow = checkIcon.closest(".r0, .r1, .form-check, tr, li, div");
      if (parentRow) {
        const clone = parentRow.cloneNode(true);
        clone.querySelectorAll(".answernumber, .optionnumber, input, i, img, svg").forEach(n => n.remove());
        const choiceText = clean(clone.textContent || "");
        if (choiceText && !choiceText.toLowerCase().includes("clear my choice")) {
          return choiceText.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim() || choiceText;
        }
      }
    }

    // 4. Check if the question is marked 100% correct
    const stateText = clean(qEl.querySelector(".state, .status")?.textContent || "").toLowerCase();
    const gradeText = clean(qEl.querySelector(".grade")?.textContent || "").toLowerCase();
    const isFullyCorrect =
      (stateText.includes("correct") && !stateText.includes("incorrect") && !stateText.includes("partially")) ||
      (gradeText.includes("1.00") && !gradeText.includes("0.00"));

    if (isFullyCorrect) {
      const checkedInput = qEl.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
      if (checkedInput) {
        const parent = checkedInput.closest(".r0, .r1, div, tr, li") || checkedInput.parentElement;
        const label =
          (checkedInput.id ? qEl.querySelector(`label[for="${CSS.escape(checkedInput.id)}"]`) : null) ||
          checkedInput.closest("label") ||
          parent?.querySelector("label") ||
          parent;
        if (label) {
          const clone = label.cloneNode(true);
          clone.querySelectorAll(".answernumber, .optionnumber, input, i, img, svg").forEach(n => n.remove());
          const choiceText = clean(clone.textContent || "");
          if (choiceText && !choiceText.toLowerCase().includes("clear my choice")) {
            return choiceText.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim() || choiceText;
          }
        }
      }

      const textField = qEl.querySelector("input[type='text'], textarea");
      if (textField && textField.value) {
        return clean(textField.value);
      }
    }

    return null;
  }

  async function harvestAll(questions) {
    if (!questions || !questions.length) {
      const d = g.AutoQuizMoodleDetector?.detect ? g.AutoQuizMoodleDetector.detect() : { questions: [...document.querySelectorAll(".que")] };
      questions = d.questions;
    }

    let learnedCount = 0;
    const learnedItems = [];

    for (let i = 0; i < questions.length; i++) {
      const qEl = questions[i];
      const extracted = g.AutoQuizExtractor ? g.AutoQuizExtractor.extract(qEl, i) : null;
      if (!extracted || !extracted.text) continue;

      const correctAnswer = extractCorrectAnswer(qEl);
      if (correctAnswer && g.AutoQuizDB) {
        await g.AutoQuizDB.add({
          id: extracted.id,
          question: extracted.text,
          questionType: extracted.type || "multiple_choice",
          options: extracted.options || [],
          answer: correctAnswer,
          explanation: "Automatically harvested from Moodle quiz review.",
          source: "moodle_review",
          verified: true
        });
        learnedCount++;
        learnedItems.push({ id: extracted.id, question: extracted.text, answer: correctAnswer });

        // Visual indicator on review question
        injectLearnedBadge(qEl, correctAnswer);
      }
    }

    if (learnedCount > 0) {
      injectSummaryBanner(learnedCount);
    }

    return { learnedCount, learnedItems };
  }

  function injectLearnedBadge(qEl, answer) {
    if (qEl.querySelector(".autoquiz-learned-badge")) return;
    const badge = document.createElement("div");
    badge.className = "autoquiz-learned-badge";
    badge.style.cssText = `
      margin: 8px 0;
      padding: 6px 12px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      color: #166534;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    badge.innerHTML = `<span>🎓 <strong>AutoQuiz AI Learned:</strong> Verified correct answer saved: <strong>${escapeHtml(answer)}</strong></span>`;
    const formulation = qEl.querySelector(".formulation") || qEl;
    formulation.prepend(badge);
  }

  function injectSummaryBanner(count) {
    if (document.getElementById("autoquiz-review-banner")) return;
    const banner = document.createElement("div");
    banner.id = "autoquiz-review-banner";
    banner.style.cssText = `
      position: sticky;
      top: 10px;
      z-index: 99999;
      margin: 10px auto;
      max-width: 900px;
      padding: 12px 18px;
      background: #ecfdf5;
      border: 2px solid #10b981;
      border-radius: 10px;
      color: #065f46;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
    `;
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">🎓</span>
        <div>
          <strong style="color:#047857;">Auto-Learning Completed!</strong>
          <div>AutoQuiz AI successfully learned and saved <strong>${count}</strong> verified correct answer(s) into your Answer Bank.</div>
        </div>
      </div>
      <button id="aq-open-bank-btn" style="background:#10b981; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">
        Open Answer Bank
      </button>
    `;
    const main = document.querySelector("#region-main, role[main], body");
    if (main) main.prepend(banner);

    const btn = banner.querySelector("#aq-open-bank-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: "AQ_OPEN_PAGE", url: "ui/bank.html" });
        }
      };
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  g.AutoQuizHarvester = { extractCorrectAnswer, harvestAll };
})(typeof globalThis !== "undefined" ? globalThis : this);

