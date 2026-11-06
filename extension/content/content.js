(function() {
  let lastQuestions = [];
  const questionElements = new Map();

  // ─── Storage keys ───────────────────────────────────────────────────────────
  const AUTO_SOLVE_KEY = "aqAutoSolveActive";
  const AUTO_SOLVE_STATS_KEY = "aqAutoSolveStats";

  function storage() {
    return new Promise(r => chrome.storage.local.get([AUTO_SOLVE_KEY, AUTO_SOLVE_STATS_KEY], r));
  }
  async function isAutoSolveActive() {
    const s = await storage();
    return !!s[AUTO_SOLVE_KEY];
  }
  async function setAutoSolveActive(val, stats = null) {
    const data = { [AUTO_SOLVE_KEY]: val };
    if (stats) data[AUTO_SOLVE_STATS_KEY] = stats;
    return new Promise(r => chrome.storage.local.set(data, r));
  }
  async function getStats() {
    const s = await storage();
    return s[AUTO_SOLVE_STATS_KEY] || { totalSolved: 0, totalLocal: 0, totalAI: 0, pagesCompleted: 0 };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Question card UI ────────────────────────────────────────────────────────
  function injectCard(el, q) {
    if (!el) return;
    let container = el.querySelector(".autoquiz-helper");
    if (!container) {
      container = document.createElement("div");
      container.className = "autoquiz-helper";
      container.style.cssText = `
        margin: 10px 0 14px 0; padding: 10px 14px;
        background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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
          <span style="color:#475569; font-size:12px;">${typeLabel} (${optCount} options)</span>
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
            <strong>${isApplied ? "Selected:" : "Suggested:"}</strong>
            <span style="color:${isApplied ? "#15803d" : "#2563eb"}; font-weight:600; font-size:14px;">${escapeHtml(q.suggestion)}</span>
            <span style="font-size:11px; color:#64748b; background:#e2e8f0; padding:1px 6px; border-radius:4px;">
              ${q.source === "local_verified" ? "⭐ verified DB" : (q.source || "AI")}
            </span>
          </div>
          ${q.explanation ? `<p style="margin:4px 0 0; color:#475569; font-size:12px; line-height:1.4;">${escapeHtml(q.explanation)}</p>` : ""}
        </div>
      ` : ""}
      <div class="aq-status" style="margin-top:4px; font-size:11px; color:#16a34a; display:${isApplied ? "block" : "none"};">
        ${isApplied ? "✓ Answer marked in Moodle" : ""}
      </div>
    `;

    container.querySelector(".aq-btn-suggest")?.addEventListener("click", async () => {
      const btn = container.querySelector(".aq-btn-suggest");
      btn.disabled = true; btn.textContent = "Thinking...";
      await getSingleSuggestion(q);
      injectCard(el, q);
    });

    container.querySelector(".aq-btn-solve-single")?.addEventListener("click", async () => {
      const btn = container.querySelector(".aq-btn-solve-single");
      btn.disabled = true; btn.textContent = "Solving...";
      try {
        if (!q.suggestion) await getSingleSuggestion(q);
        applySingleAnswer(q);
        q.state = "applied";
        injectCard(el, q);
      } catch (e) {
        const status = container.querySelector(".aq-status");
        if (status) { status.style.display = "block"; status.style.color = "#dc2626"; status.textContent = "⚠ " + e.message; }
      }
    });

    container.querySelector(".aq-btn-apply")?.addEventListener("click", () => {
      try {
        applySingleAnswer(q);
        q.state = "applied";
        injectCard(el, q);
      } catch (err) {
        const status = container.querySelector(".aq-status");
        if (status) { status.style.display = "block"; status.style.color = "#dc2626"; status.textContent = "⚠ " + err.message; }
      }
    });
  }

  // ─── Floating toolbar ────────────────────────────────────────────────────────
  function injectFloatingToolbar(questionCount) {
    let toolbar = document.getElementById("autoquiz-floating-toolbar");
    if (toolbar) { toolbar.remove(); } // always refresh

    toolbar = document.createElement("div");
    toolbar.id = "autoquiz-floating-toolbar";
    toolbar.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      background: #1e293b; color: #fff; padding: 10px 16px; border-radius: 12px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; min-width: 320px;
    `;
    toolbar.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex:1;">
        <span style="background:#60a5fa; color:#0f172a; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11px;">AQ</span>
        <span id="aq-toolbar-label"><strong>${questionCount}</strong> questions on page</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button id="aq-toolbar-autosolve" style="background:#7c3aed; color:#fff; border:none; padding:6px 14px; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px;">
          ⚡ Auto-Solve Quiz
        </button>
        <button id="aq-toolbar-stop" style="background:#dc2626; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px; display:none;">
          ■ Stop
        </button>
      </div>
    `;
    document.body.appendChild(toolbar);

    toolbar.querySelector("#aq-toolbar-autosolve").addEventListener("click", async () => {
      const solveBtn = toolbar.querySelector("#aq-toolbar-autosolve");
      const stopBtn = toolbar.querySelector("#aq-toolbar-stop");
      solveBtn.disabled = true;
      solveBtn.textContent = "Starting...";
      stopBtn.style.display = "inline-block";

      // Reset stats and set active flag
      await setAutoSolveActive(true, { totalSolved: 0, totalLocal: 0, totalAI: 0, pagesCompleted: 0 });
      await runAutoSolveLoop(toolbar);
    });

    toolbar.querySelector("#aq-toolbar-stop").addEventListener("click", async () => {
      await setAutoSolveActive(false);
      updateToolbarLabel(toolbar, "⛔ Stopped by user");
      toolbar.querySelector("#aq-toolbar-autosolve").disabled = false;
      toolbar.querySelector("#aq-toolbar-autosolve").textContent = "⚡ Auto-Solve Quiz";
      toolbar.querySelector("#aq-toolbar-stop").style.display = "none";
    });
  }

  function updateToolbarLabel(toolbar, text) {
    const label = toolbar?.querySelector("#aq-toolbar-label");
    if (label) label.innerHTML = text;
  }

  // ─── Scan ────────────────────────────────────────────────────────────────────
  function scan() {
    const d = AutoQuizMoodleDetector.detect();
    if (!d.isMoodle) {
      return { isMoodle: false, isReview: false, questions: [], message: "No Moodle quiz questions detected." };
    }

    // Review page — auto-harvest
    if (d.isReview && typeof AutoQuizHarvester !== "undefined") {
      AutoQuizHarvester.harvestAll(d.questions);
      // Clear auto-solve flag when we reach the review page
      setAutoSolveActive(false);
      return { isMoodle: true, isReview: true, questions: [], message: "Review page: auto-learning confirmed answers." };
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

  // ─── AI suggestion ───────────────────────────────────────────────────────────
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
          body: JSON.stringify({ question: q.text, questionType: q.type, options: q.options })
        });
        if (!r.ok) throw new Error(`Backend ${r.status}`);
        const data = await r.json();
        q.suggestion = data.suggestedAnswer || data.answer;
        q.source = data.source || "ai_suggestion";
        q.explanation = data.explanation;
        q.uncertainty = data.uncertainty;
      } catch (e) {
        q.error = e.message;
      }
    }
    await AutoQuizProgress.update([q]);
    return q;
  }

  // ─── Apply answer ─────────────────────────────────────────────────────────────
  function applySingleAnswer(q) {
    const el = questionElements.get(q.id) || document.getElementById(q.id);
    if (!el) throw new Error("Question element not found on page.");
    if (!q.suggestion) throw new Error("No suggestion available.");
    const res = AutoQuizAnswerApplier.apply(el, q.suggestion);
    q.state = "applied";
    AutoQuizProgress.mark(q.id, "applied");
    return res;
  }

  // ─── Solve current page ───────────────────────────────────────────────────────
  async function solveCurrentPage() {
    if (!lastQuestions.length) scan();
    let solvedCount = 0, localMatches = 0, aiCount = 0;
    const errors = [];

    for (const q of lastQuestions) {
      // Check stop flag between each question
      if (!(await isAutoSolveActive())) return { stopped: true, solvedCount, errors };

      try {
        if (!q.suggestion) await getSingleSuggestion(q);
        if (q.source === "local_verified") localMatches++; else aiCount++;

        if (q.suggestion) {
          applySingleAnswer(q);
          q.state = "applied";
          solvedCount++;
          const el = questionElements.get(q.id);
          if (el) injectCard(el, q);
        }
        // Small human-like delay between answering questions (400-800ms)
        await sleep(400 + Math.random() * 400);
      } catch (err) {
        errors.push(`${q.id}: ${err.message}`);
      }
    }

    await AutoQuizProgress.update(lastQuestions);
    return { stopped: false, solvedCount, localMatches, aiCount, errors, total: lastQuestions.length };
  }

  // ─── Full quiz auto-solve loop (page by page) ─────────────────────────────────
  async function runAutoSolveLoop(toolbar) {
    const stats = await getStats();
    const totalBtn = toolbar?.querySelector("#aq-toolbar-autosolve");

    updateToolbarLabel(toolbar, `⚡ Solving page...`);

    // Solve all questions on this page
    const result = await solveCurrentPage();

    if (result.stopped) {
      updateToolbarLabel(toolbar, `⛔ Stopped. Solved ${stats.totalSolved} total`);
      if (totalBtn) { totalBtn.disabled = false; totalBtn.textContent = "⚡ Auto-Solve Quiz"; }
      toolbar?.querySelector("#aq-toolbar-stop")?.style && (toolbar.querySelector("#aq-toolbar-stop").style.display = "none");
      return;
    }

    // Accumulate stats
    stats.totalSolved += result.solvedCount;
    stats.totalLocal += result.localMatches || 0;
    stats.totalAI += result.aiCount || 0;
    stats.pagesCompleted += 1;
    await setAutoSolveActive(true, stats);

    updateToolbarLabel(toolbar,
      `✓ Page ${stats.pagesCompleted} done &nbsp;·&nbsp; Solved <strong>${result.solvedCount}/${result.total}</strong> &nbsp;·&nbsp; Total: <strong>${stats.totalSolved}</strong>`
    );

    // Check active flag before navigating
    if (!(await isAutoSolveActive())) {
      updateToolbarLabel(toolbar, `⛔ Stopped after page ${stats.pagesCompleted}`);
      return;
    }

    // Wait a moment so Moodle's autosave catches up (2 seconds)
    await sleep(2000);

    // Find nav button
    const nav = AutoQuizNavigation.getNavigation();

    if (nav.isFinish && nav.button) {
      updateToolbarLabel(toolbar, `🏁 All pages done! Clicking Finish attempt...`);
      await sleep(800);
      // The flag stays active so the summary/review page script knows to harvest
      nav.button.click();
      return; // page will navigate
    }

    if (nav.hasNext && nav.button) {
      updateToolbarLabel(toolbar, `➡️ Going to next page...`);
      await sleep(600);
      nav.button.click(); // page navigates; new page's init() picks up the flag
      return;
    }

    // No navigation found — quiz may be single-page or something unexpected
    updateToolbarLabel(toolbar, `✅ Quiz solved! ${stats.totalSolved} answers applied across ${stats.pagesCompleted} page(s).`);
    await setAutoSolveActive(false);
    if (totalBtn) { totalBtn.disabled = false; totalBtn.textContent = "✅ Done"; }
    toolbar?.querySelector("#aq-toolbar-stop") && (toolbar.querySelector("#aq-toolbar-stop").style.display = "none");
  }

  // ─── Suggest all ──────────────────────────────────────────────────────────────
  async function suggestAll() {
    if (!lastQuestions.length) scan();
    for (const q of lastQuestions) {
      await getSingleSuggestion(q);
      const el = questionElements.get(q.id);
      if (el) injectCard(el, q);
    }
    await AutoQuizProgress.update(lastQuestions);
    return {
      message: `Suggestions ready for ${lastQuestions.length} question(s).`,
      questions: lastQuestions.map(({ _index, ...q }) => q)
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

  // ─── Message listener ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((m, s, reply) => {
    (async () => {
      const action = m.action || m.type;
      if (action === "AQ_SCAN" || action === "SCAN_MOODLE") return scan();
      if (action === "AQ_GET_QUESTIONS") {
        if (!lastQuestions.length) scan();
        return { questions: lastQuestions.map(({ _index, ...q }) => q) };
      }
      if (action === "AQ_GET_PROGRESS") {
        const d = AutoQuizMoodleDetector.detect();
        const autoActive = await isAutoSolveActive();
        return { isMoodle: d.isMoodle, isReview: d.isReview, autoSolveActive: autoActive, progress: await AutoQuizProgress.summary() };
      }
      if (action === "AQ_SUGGEST_VISIBLE") return suggestAll();
      if (action === "AQ_AUTO_SOLVE") {
        // Triggered from popup — start the full quiz loop
        await setAutoSolveActive(true, { totalSolved: 0, totalLocal: 0, totalAI: 0, pagesCompleted: 0 });
        const toolbar = document.getElementById("autoquiz-floating-toolbar");
        const solveBtn = toolbar?.querySelector("#aq-toolbar-autosolve");
        const stopBtn = toolbar?.querySelector("#aq-toolbar-stop");
        if (solveBtn) { solveBtn.disabled = true; solveBtn.textContent = "Solving..."; }
        if (stopBtn) stopBtn.style.display = "inline-block";
        runAutoSolveLoop(toolbar); // fire-and-forget, reply immediately
        return { started: true, message: "Auto-Solve started on this page." };
      }
      if (action === "AQ_STOP_AUTO_SOLVE") {
        await setAutoSolveActive(false);
        return { stopped: true };
      }
      if (action === "AQ_HARVEST_REVIEW") {
        if (typeof AutoQuizHarvester !== "undefined") return AutoQuizHarvester.harvestAll();
        return { learnedCount: 0 };
      }
      if (action === "AQ_APPLY_ANSWER" || action === "APPLY_ANSWER") {
        const qid = m.id || m.payload?.id;
        const answer = m.answer || m.payload?.answer;
        let q = lastQuestions.find(x => x.id === qid);
        if (!q) q = { id: qid, suggestion: answer };
        else if (answer) q.suggestion = answer;
        return applySingleAnswer(q);
      }
      if (action === "AQ_APPLY_ALL") return applyAll();
      return { ok: false };
    })()
      .then(reply)
      .catch(e => reply({ error: e.message }));
    return true;
  });

  // ─── Init on page load ────────────────────────────────────────────────────────
  async function init() {
    const d = AutoQuizMoodleDetector.detect();
    if (!d.isMoodle) return;

    scan(); // builds questions, injects toolbar

    // If auto-solve was running across pages, resume automatically
    if (!d.isReview && await isAutoSolveActive()) {
      const toolbar = document.getElementById("autoquiz-floating-toolbar");
      const solveBtn = toolbar?.querySelector("#aq-toolbar-autosolve");
      const stopBtn = toolbar?.querySelector("#aq-toolbar-stop");
      if (solveBtn) { solveBtn.disabled = true; solveBtn.textContent = "Solving..."; }
      if (stopBtn) stopBtn.style.display = "inline-block";
      updateToolbarLabel(toolbar, "⚡ Resuming auto-solve...");
      // Small delay to let Moodle's page fully settle
      await sleep(1200);
      await runAutoSolveLoop(toolbar);
    }
  }

  setTimeout(init, 1000);
})();
