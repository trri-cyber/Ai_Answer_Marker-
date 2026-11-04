(async () => {
  const p = await AutoQuizProgress.read();
  const items = Object.values(p);

  const appliedCount = items.filter(x => x.state === "applied").length;
  const needReviewCount = items.filter(x => x.state === "needs_review").length;

  document.getElementById("summary").textContent = `${items.length} detected · ${appliedCount} applied · ${needReviewCount} need review`;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.getElementById("items").innerHTML =
    items
      .map(x => {
        const optionsList = (x.options || [])
          .map(opt => `<li style="font-size:13px; color:#475569;">${escapeHtml(opt)}</li>`)
          .join("");

        return `
      <div class="record" style="margin-bottom:14px; padding:12px; border:1px solid #e2e8f0; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(x.id)}</strong>
          <span class="badge" style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-size:12px;">${x.state || "unanswered"}</span>
        </div>
        <p style="margin:8px 0; font-size:14px; font-weight:500;">${escapeHtml(x.text || "")}</p>
        ${optionsList ? `<ul style="margin:4px 0 8px 18px; padding:0;">${optionsList}</ul>` : ""}
        ${
          x.suggestion
            ? `
          <div style="margin-top:6px; padding:8px; background:#f0fdf4; border-radius:6px; border:1px solid #bbf7d0;">
            <div style="font-size:13px; color:#166534; font-weight:600;">
              💡 Suggestion: ${escapeHtml(x.suggestion)}
            </div>
            ${x.explanation ? `<div style="font-size:12px; color:#475569; margin-top:3px;">${escapeHtml(x.explanation)}</div>` : ""}
          </div>
        `
            : ""
        }
      </div>
    `;
      })
      .join("") || "<p style='color:#64748b;'>No quiz progress recorded yet. Open a Moodle quiz page and scan to begin.</p>";
})();
