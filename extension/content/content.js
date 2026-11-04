(function() {
  let lastQuestions = [];
  const questionElements = new Map();

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectCard(el, q) {
    if (!el) return;
    let container = el.querySelector(".autoquiz-helper");
    if (!container) {
      container = document.createElement("div");
      container.className = "autoquiz-helper";
      container.style.cssText = `
        margin: 10px 0 14px 0;
        padding: 10px 14px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: #1e293b;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      `;
      const qtext = el.querySelector(".qtext") || el.querySelector(".formulation") || el.firstChild;
      if (qtext && qtext.parentElement) {
        qtext.parentElement.insertBefore(container, qtext.nextSibling);
      } else {
        el.prepend(container);
      }
    }

    const optCount = q.options?.length || 0;
    const typeLabel = (q.type || "Question").replace(/_/g, " ");
    const isApplied = q.state === "applied";

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:${isApplied ? "#16a34a" : "#2563eb"}; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px; text-transform:uppercase;">
            ${isApplied ? "✓ Solved" : "AutoQuiz AI"}
          </span>
          <span style="color:#475569; font-size:12px;">${typeLabel} (${optCount} options detected)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="aq-btn-suggest" style="background:#0284c7; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:500;">
            ${q.suggestion ? "Re-Check" : "💡 Get AI Answer"}
          </button>
          <button class="aq-btn-solve-single" style="background:#7c3aed; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:500;">
            ⚡ Auto-Solve
          </button>
          ${q.suggestion && !isApplied ? `<button class="aq-btn-apply" style="background:#16a34a; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:500;">✓ Apply</button>` : ""}
        </div>
      </div>
      ${q.suggestion ? `
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1;">
          <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
            <strong>${isApplied ? "Selected Answer:" : "Suggested Answer:"}</strong>
            <span style="color:${isApplied ? "#15803d" : "#2563eb"}; font-weight:600; font-size:14px;">${escapeHtml(q.suggestion)}</span>
            <span style="font-size:11px; color:#64748b; background:#e2e8f0; padding:1px 6px; border-radius:4px;">
              ${q.source === "local_verified" ? "⭐ verified local bank" : (q.source || "AI")}
            </span>
          </div>
          ${q.explanation ? `<p style="margin:4px 0 0 0; color:#475569; font-size:12px; line-height:1.4;">${escapeHtml(q.explanation)}</p>` : ""}
        </div>
      ` : ""}
      <div class="aq-status" style="margin-top:4px; font-size:11px; color:#16a34a; display:${isApplied ? "block" : "none"};">
        ${isApplied ? "✓ Answer marked in Moodle" : ""}
      </div>
    `;

    const suggestBtn = container.querySelector(".aq-btn-suggest");
    if (suggestBtn) {
      suggestBtn.onclick = async () => {
        suggestBtn.disabled = true;
        suggestBtn.textContent = "Thinking...";
        await getSingleSuggestion(q);
        injectCard(el, q);
      };
    }

    const solveSingleBtn = container.querySelector(".aq-btn-solve-single");
    if (solveSingleBtn) {
      solveSingleBtn.onclick = async () => {
        solveSingleBtn.disabled = true;
        solveSingleBtn.textContent = "Solving...";
        try {
          if (!q.suggestion) await getSingleSuggestion(q);
          applySingleAnswer(q);
          q.state = "applied";
          injectCard(el, q);
        } catch (e) {
          const status = container.querySelector(".aq-status");
          if (status) {
            status.style.display = "block";
            status.style.color = "#dc2626";
            status.textContent = "⚠ " + e.message;
          }
        }
      };
    }

    const applyBtn = container.querySelector(".aq-btn-apply");
    if (applyBtn) {
      applyBtn.onclick = () => {
        try {
          applySingleAnswer(q);
          q.state = "applied";
          injectCard(el, q);
        } catch (err) {
          const status = container.querySelector(".aq-status");
          if (status) {
            status.style.display = "block";
            status.style.color = "#dc2626";
            status.textContent = "⚠ " + err.message;
          }
        }
      };
    }
  }

  function injectFloatingToolbar(questionCount) {
    if (document.getElementById("autoquiz-floating-toolbar")) return;
    const toolbar = document.createElement("div");
    toolbar.id = "autoquiz-floating-toolbar";
    toolbar.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: #1e293b;
      color: #fff;
      padding: 10px 16px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    `;
    toolbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="background:#60a5fa; color:#0f172a; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11px;">AQ</span>
        <span><strong>${questionCount}</strong> questions</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="aq-toolbar-autosolve" style="background:#7c3aed; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">
          ⚡ Auto-Solve All
        </button>
        <button id="aq-toolbar-suggest" style="background:#0284c7; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px;">
          💡 Suggestions
        </button>
      </div>
    `;
    document.body.appendChild(toolbar);

    toolbar.querySelector("#aq-toolbar-autosolve").onclick = async () => {
      const btn = toolbar.querySelector("#aq-toolbar-autosolve");
      btn.disabled = true;
      btn.textContent = "Solving Quiz...";
      const res = await autoSolveAll();
      btn.disabled = false;
      btn.textContent = `✓ Solved ${res.solvedCount}/${res.total}`;
    };

    toolbar.querySelector("#aq-toolbar-suggest").onclick = async () => {
      const btn = toolbar.querySelector("#aq-toolbar-suggest");
      btn.disabled = true;
      btn.textContent = "Thinking...";
      await suggestAll();
      btn.disabled = false;
      btn.textContent = "✓ Suggestions Ready";
    };
  }

  function scan() {
    const d = AutoQuizMoodleDetector.detect();
    if (!d.isMoodle) {
      return { isMoodle: false, isReview: false, questions: [], message: "No Moodle quiz questions detected on this page." };
    }

    // If on review page, trigger auto-learning harvest
    if (d.isReview && typeof AutoQuizHarvester !== "undefined") {
      AutoQuizHarvester.harvestAll(d.questions);
      return {
        isMoodle: true,
        isReview: true,
        questions: [],
        message: "Moodle Review page detected. Auto-learning harvested confirmed answers."
      };
    }

    questionElements.clear();
    lastQuestions = d.questions.map((el, i) => {
      const extracted = AutoQuizExtractor.extract(el, i);
      questionElements.set(extracted.id, el);
      injectCard(el, extracted);
      return { ...extracted, _index: i };
    });

    AutoQuizProgress.update(lastQuestions);
    injectFloatingToolbar(lastQuestions.length);

    return {
      isMoodle: true,
      isReview: false,
      questions: lastQuestions.map(({ _index, ...q }) => q),
      message: `Detected ${lastQuestions.length} question(s) with options.`
    };
  }

  async function getSingleSuggestion(q) {
    const found = await AutoQuizMatcher.match(q);
    if (found.match) {
      q.suggestion = found.match.answer;
      q.source = "local_verified";
      q.explanation = found.match.explanation || "Found verified match in your local database.";
      q.uncertainty = "low";
    } else {
      try {
        const r = await fetch("http://127.0.0.1:3030/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q.text,
            questionType: q.type,
            options: q.options
          })
        });
        if (!r.ok) throw new Error(`Backend returned ${r.status}`);
        const data = await r.json();
        q.suggestion = data.suggestedAnswer || data.answer;
        q.source = data.source || "gemini_suggestion";
        q.explanation = data.explanation;
        q.uncertainty = data.uncertainty;
      } catch (e) {
        q.error = e.message;
      }
    }
    await AutoQuizProgress.update([q]);
    return q;
  }

  async function suggestAll() {
    if (!lastQuestions.length) scan();
    let count = 0;
    for (const q of lastQuestions) {
      await getSingleSuggestion(q);
      const el = questionElements.get(q.id);
      if (el) injectCard(el, q);
      count++;
    }
    await AutoQuizProgress.update(lastQuestions);
    return {
      message: `Prepared ${count} suggestion(s). Questions updated with answers.`,
      questions: lastQuestions.map(({ _index, ...q }) => q)
    };
  }

  function applySingleAnswer(q) {
    const el = questionElements.get(q.id) || document.getElementById(q.id);
    if (!el) throw new Error("Question element not found on page.");
    if (!q.suggestion) throw new Error("No suggestion available for this question.");

    const res = AutoQuizAnswerApplier.apply(el, q.suggestion);
    q.state = "applied";
    AutoQuizProgress.mark(q.id, "applied");
    return res;
  }

  async function autoSolveAll() {
    if (!lastQuestions.length) scan();
    let solvedCount = 0;
    let localMatches = 0;
    let aiCount = 0;
    const errors = [];

    for (const q of lastQuestions) {
      try {
        // 1. Get suggestion (local DB first, then AI)
        if (!q.suggestion) {
          await getSingleSuggestion(q);
        }
        if (q.source === "local_verified") localMatches++;
        else aiCount++;

        // 2. Automatically apply answer
        if (q.suggestion) {
          applySingleAnswer(q);
          q.state = "applied";
          solvedCount++;
          const el = questionElements.get(q.id);
          if (el) injectCard(el, q);
        }
      } catch (err) {
        errors.push(`${q.id}: ${err.message}`);
      }
    }

    await AutoQuizProgress.update(lastQuestions);
    return {
      total: lastQuestions.length,
      solvedCount,
      localMatches,
      aiCount,
      errors,
      message: `Auto-Solved ${solvedCount} of ${lastQuestions.length} questions (${localMatches} from local DB, ${aiCount} from AI).`
    };
  }

  function applyAll() {
    let appliedCount = 0;
    const errors = [];
    for (const q of lastQuestions) {
      if (q.suggestion) {
        try {
          applySingleAnswer(q);
          appliedCount++;
          q.state = "applied";
          const el = questionElements.get(q.id);
          if (el) injectCard(el, q);
        } catch (err) {
          errors.push(`${q.id}: ${err.message}`);
        }
      }
    }
    return { appliedCount, total: lastQuestions.length, errors };
  }

  chrome.runtime.onMessage.addListener((m, s, reply) => {
    (async () => {
      const action = m.action || m.type;
      if (action === "AQ_SCAN" || action === "SCAN_MOODLE") {
        return scan();
      }
      if (action === "AQ_GET_QUESTIONS") {
        if (!lastQuestions.length) scan();
        return { questions: lastQuestions.map(({ _index, ...q }) => q) };
      }
      if (action === "AQ_GET_PROGRESS") {
        const d = AutoQuizMoodleDetector.detect();
        return { isMoodle: d.isMoodle, isReview: d.isReview, progress: await AutoQuizProgress.summary() };
      }
      if (action === "AQ_SUGGEST_VISIBLE") {
        return suggestAll();
      }
      if (action === "AQ_AUTO_SOLVE") {
        return autoSolveAll();
      }
      if (action === "AQ_HARVEST_REVIEW") {
        if (typeof AutoQuizHarvester !== "undefined") {
          return AutoQuizHarvester.harvestAll();
        }
        return { learnedCount: 0 };
      }
      if (action === "AQ_APPLY_ANSWER" || action === "APPLY_ANSWER") {
        const qid = m.id || m.payload?.id;
        const answer = m.answer || m.payload?.answer;
        let q = lastQuestions.find(x => x.id === qid);
        if (!q) {
          q = { id: qid, suggestion: answer };
        } else if (answer) {
          q.suggestion = answer;
        }
        return applySingleAnswer(q);
      }
      if (action === "AQ_APPLY_ALL") {
        return applyAll();
      }
      return { ok: false };
    })()
      .then(reply)
      .catch(e => reply({ error: e.message }));
    return true;
  });

  setTimeout(() => {
    try {
      const d = AutoQuizMoodleDetector.detect();
      if (d.isMoodle) {
        scan();
      }
    } catch (_) {}
  }, 1000);
})();
