(() => {
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

  function detectType(question) {
    if (question.querySelector('input[type="checkbox"]')) return "multiple_select";
    if (question.querySelector('input[type="radio"]')) return "multiple_choice";
    if (question.querySelector('textarea')) return "essay";
    if (question.querySelector('input[type="text"], input:not([type])')) return "short_answer";
    return "unknown";
  }

  function extractChoices(node) {
    const answerContainer = node.querySelector(".answer, .formulation") || node;
    const inputs = [...answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]')].filter(input => {
      const parent = input.closest(".r0, .r1, div, tr, li") || input.parentElement;
      const isClear =
        input.classList.contains("clearchoice") ||
        parent?.classList.contains("clearchoice") ||
        (input.id && input.id.toLowerCase().includes("clearchoice")) ||
        input.value === "-1" ||
        clean(parent?.textContent).toLowerCase() === "clear my choice";
      return !isClear;
    });

    const choices = [];
    inputs.forEach((input, idx) => {
      const parent = input.closest(".r0, .r1, .form-check, tr, li, div") || input.parentElement;
      let labelEl = input.id ? node.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
      if (!labelEl) labelEl = input.closest("label") || parent?.querySelector("label");

      let text = "";
      if (labelEl) {
        const clone = labelEl.cloneNode(true);
        clone.querySelectorAll(".answernumber, .optionnumber, input").forEach(n => n.remove());
        text = clean(clone.innerText || clone.textContent);
      }
      if (!text && parent) {
        const clone = parent.cloneNode(true);
        clone.querySelectorAll("input, .answernumber, .optionnumber").forEach(n => n.remove());
        text = clean(clone.innerText || clone.textContent);
      }

      const numEl = (labelEl || parent)?.querySelector(".answernumber, .optionnumber");
      const letter = numEl ? clean(numEl.textContent).replace(/[^a-zA-Z0-9]/g, "") : String.fromCharCode(65 + idx);
      const stripped = text.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim();
      const choiceText = `${letter ? letter.toUpperCase() + ". " : ""}${stripped || text || `Option ${idx + 1}`}`;
      choices.push(choiceText);
    });

    if (!choices.length) {
      const rawLabels = [...answerContainer.querySelectorAll(".answer label, .answer .r0, .answer .r1, .answer li")];
      rawLabels.forEach((l, idx) => {
        const txt = clean(l.innerText || l.textContent);
        if (txt && !txt.toLowerCase().includes("clear my choice") && !txt.toLowerCase().startsWith("select one")) {
          choices.push(`${String.fromCharCode(65 + idx)}. ${txt}`);
        }
      });
    }

    return choices;
  }

  function scanQuestions() {
    const nodes = [...document.querySelectorAll(".que")];
    return nodes
      .map((node, index) => {
        const prompt = node.querySelector(".qtext, .formulation .qtext") || node;
        const choices = extractChoices(node);
        const inputs = [...node.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], textarea')];
        return {
          id: node.id || `question-${index + 1}`,
          number: index + 1,
          type: detectType(node),
          questionType: detectType(node),
          question: clean(prompt?.innerText || prompt?.textContent),
          text: clean(prompt?.innerText || prompt?.textContent),
          choices,
          options: choices,
          inputCount: inputs.length
        };
      })
      .filter(item => item.question);
  }

  function applyAnswer({ id, answer }) {
    const question = document.getElementById(id);
    if (!question) return { ok: false, message: "Question is no longer on this page." };

    try {
      if (typeof AutoQuizAnswerApplier !== "undefined") {
        const res = AutoQuizAnswerApplier.apply(question, answer);
        return { ok: true, message: "Suggested option selected. Please verify it.", ...res };
      }
    } catch (e) {
      return { ok: false, message: e.message };
    }

    return { ok: false, message: "This question type is not supported for applying answers yet." };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCAN_MOODLE" || message.action === "SCAN_MOODLE") {
      sendResponse({
        url: location.href,
        title: document.title,
        isMoodle: !!document.querySelector(".que, #page-mod-quiz-attempt"),
        questions: scanQuestions()
      });
      return true;
    }
    if (message.type === "APPLY_ANSWER" || message.action === "APPLY_ANSWER") {
      sendResponse(applyAnswer(message.payload || message));
      return true;
    }
  });
})();
