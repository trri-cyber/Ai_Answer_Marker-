(function(g) {
  function clean(str) {
    return String(str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getNavigation() {
    // 1. Direct Moodle next button selectors
    const nextBtn = document.querySelector(
      "input#mod_quiz-next-nav, .mod_quiz-next-nav, input[name='next'], button[name='next']"
    );

    if (nextBtn) {
      const label = clean(nextBtn.value || nextBtn.textContent);
      const isFinish = label.includes("finish") || label.includes("summary") || label.includes("submit all");
      return {
        hasNext: !isFinish,
        isFinish,
        button: nextBtn,
        label: nextBtn.value || nextBtn.textContent || "Next page"
      };
    }

    // 2. Search inside Moodle form submitbtns container
    const submitBtns = [
      ...document.querySelectorAll("form#responseform input[type='submit'], form#responseform button[type='submit'], .submitbtns input, .submitbtns button")
    ];

    for (const btn of submitBtns) {
      const label = clean(btn.value || btn.textContent);
      if (label.includes("finish attempt") || label.includes("end test") || label.includes("summary")) {
        return { hasNext: false, isFinish: true, button: btn, label: btn.value || btn.textContent };
      }
      if (label.includes("next page") || label === "next" || label.startsWith("next")) {
        return { hasNext: true, isFinish: false, button: btn, label: btn.value || btn.textContent };
      }
    }

    // 3. Check for finish attempt link in navigation block
    const endLink = document.querySelector(".endtestlink, a[href*='summary.php']");
    if (endLink) {
      return { hasNext: false, isFinish: true, button: endLink, label: "Finish attempt ..." };
    }

    // 4. Check if on summary or review page
    const pathname = typeof location !== "undefined" ? location.pathname : "";
    if (pathname.includes("summary.php") || document.querySelector("#page-mod-quiz-summary")) {
      return { hasNext: false, isFinish: true, button: null, label: "Summary of attempt" };
    }

    return { hasNext: false, isFinish: false, button: null, label: "" };
  }

  function detect() {
    return [...document.querySelectorAll('input[type="submit"],button,a')]
      .filter(e => /next|previous|finish|submit all/i.test((e.innerText || e.value || "").trim()))
      .map(e => ({ label: (e.innerText || e.value || "").trim(), disabled: !!e.disabled }));
  }

  g.AutoQuizNavigation = { detect, getNavigation };
})(typeof globalThis !== "undefined" ? globalThis : this);
