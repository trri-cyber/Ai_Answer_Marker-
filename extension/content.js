(() => {
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

  function detectType(question) {
    if (question.querySelector('input[type="radio"]')) return "single_choice";
    if (question.querySelector('input[type="checkbox"]')) return "multiple_choice";
    if (question.querySelector('textarea')) return "essay";
    if (question.querySelector('input[type="text"], input:not([type])')) return "short_answer";
    return "unknown";
  }

  function scanQuestions() {
    const nodes = [...document.querySelectorAll(".que")];
    return nodes.map((node, index) => {
      const prompt = node.querySelector(".qtext");
      const choices = [...node.querySelectorAll(".answer label")].map(label => clean(label.innerText));
      const inputs = [...node.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], textarea')];
      return {
        id: node.id || `question-${index + 1}`,
        number: index + 1,
        type: detectType(node),
        question: clean(prompt?.innerText),
        choices,
        inputCount: inputs.length
      };
    }).filter(item => item.question);
  }

  function applyAnswer({ id, answer }) {
    const question = document.getElementById(id);
    if (!question) return { ok: false, message: "Question is no longer on this page." };

    const text = String(answer || "").trim();
    const radios = [...question.querySelectorAll('input[type="radio"]')];
    const checks = [...question.querySelectorAll('input[type="checkbox"]')];

    if (radios.length || checks.length) {
      const labels = [...question.querySelectorAll(".answer label")];
      const wanted = text.toLowerCase();
      const match = labels.find(label => label.innerText.trim().toLowerCase() === wanted)
        || labels.find(label => label.innerText.trim().toLowerCase().includes(wanted));
      if (!match) return { ok: false, message: "Could not match the suggestion to a Moodle option. Select it manually." };
      const input = match.querySelector("input") || question.querySelector(`#${CSS.escape(match.getAttribute("for") || "")}`);
      if (!input) return { ok: false, message: "Could not locate the option input." };
      input.click();
      return { ok: true, message: "Suggested option selected. Please verify it." };
    }

    const field = question.querySelector('textarea, input[type="text"], input:not([type])');
    if (field) {
      field.focus();
      field.value = text;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, message: "Suggested text entered. Please verify it." };
    }

    return { ok: false, message: "This question type is not supported for applying answers yet." };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCAN_MOODLE") {
      sendResponse({ url: location.href, title: document.title, isMoodle: !!document.querySelector(".que, #page-mod-quiz-attempt"), questions: scanQuestions() });
      return true;
    }
    if (message.type === "APPLY_ANSWER") {
      sendResponse(applyAnswer(message.payload));
      return true;
    }
  });
})();