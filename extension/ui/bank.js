const $ = id => document.getElementById(id);

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function render() {
  const rows = await AutoQuizDB.all();
  $("records").innerHTML = rows.map(r => `
    <div class="record">
      <div style="font-weight:600; font-size:14px; color:#0f172a;">${esc(r.question)}</div>
      <p style="margin:6px 0; color:#16a34a; font-weight:600; font-size:14px;">✓ ${esc(String(r.answer))}</p>
      ${r.explanation ? `<p style="margin:4px 0; color:#475569; font-size:12px;">${esc(r.explanation)}</p>` : ""}
      <div class="muted">
        ${esc(r.questionType)} · ${r.verified ? "<strong style='color:#16a34a;'>Verified</strong>" : "Unverified"} · Source: ${esc(r.source)}
      </div>
      <button data-delete="${r.id}" style="margin-top:8px; background:#ef4444; padding:4px 10px; font-size:11px;">Delete</button>
    </div>
  `).join("") || "<p style='color:#64748b;'>No saved answers yet. Take quizzes or auto-learn from review pages to populate your bank.</p>";
}

$("add").onclick = async () => {
  const q = $("question").value.trim();
  const a = $("answer").value.trim();
  if (!q || !a) return alert("Please enter both question and answer.");

  await AutoQuizDB.add({
    question: q,
    questionType: $("type").value,
    answer: a,
    explanation: $("explanation").value.trim(),
    verified: $("verified").checked,
    source: $("verified").checked ? "user_verified" : "unverified"
  });

  $("question").value = "";
  $("answer").value = "";
  $("explanation").value = "";
  await render();
};

$("records").onclick = async e => {
  const id = e.target.dataset.delete;
  if (id && confirm("Delete this answer from your local bank?")) {
    await AutoQuizDB.remove(id);
    render();
  }
};

$("export").onclick = async () => {
  const blob = new Blob([await AutoQuizDB.export()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "autoquiz-answer-bank.json";
  a.click();
  URL.revokeObjectURL(a.href);
};

$("import").onchange = async e => {
  const f = e.target.files[0];
  if (f) {
    try {
      await AutoQuizDB.import(await f.text());
      await render();
      alert("Import completed successfully!");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  }
};

render();

