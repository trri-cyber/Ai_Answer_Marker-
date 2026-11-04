(function(g) {
  const KEY = "autoQuizProgress";

  async function read() {
    return new Promise(r => chrome.storage.local.get(KEY, v => r(v[KEY] || {})));
  }

  async function save(p) {
    return new Promise(r => chrome.storage.local.set({ [KEY]: p }, r));
  }

  async function update(questions) {
    const p = await read();
    for (const q of questions) {
      p[q.id] = {
        ...p[q.id],
        id: q.id,
        number: q.number,
        type: q.type || q.questionType,
        text: q.text || q.question,
        options: q.options || q.choices || [],
        optionsDetail: q.optionsDetail || [],
        suggestion: q.suggestion || p[q.id]?.suggestion || null,
        source: q.source || p[q.id]?.source || null,
        explanation: q.explanation || p[q.id]?.explanation || null,
        state: q.state || p[q.id]?.state || (q.suggestion ? "suggested" : "detected"),
        detected: true,
        updatedAt: Date.now()
      };
    }
    await save(p);
    return p;
  }

  async function mark(id, state, extra = {}) {
    const p = await read();
    if (p[id]) {
      p[id] = { ...p[id], state, ...extra, updatedAt: Date.now() };
    }
    await save(p);
    return p;
  }

  async function summary() {
    const p = await read();
    const a = Object.values(p);
    return {
      total: a.length,
      applied: a.filter(x => x.state === "applied").length,
      needsReview: a.filter(x => x.state === "needs_review").length,
      suggested: a.filter(x => x.state === "suggested" || x.suggestion).length,
      unanswered: a.filter(x => !["applied", "reviewed"].includes(x.state)).length
    };
  }

  g.AutoQuizProgress = { read, save, update, mark, summary };
})(typeof globalThis !== "undefined" ? globalThis : this);
