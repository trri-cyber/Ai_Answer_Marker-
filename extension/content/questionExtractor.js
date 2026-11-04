(function(g) {
  function clean(str) {
    if (!str) return "";
    return String(str)
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractOptions(el) {
    const answerContainer = el.querySelector(".answer, .formulation") || el;

    // Find radio and checkbox inputs
    const inputs = [...answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]')];

    // Filter out Moodle's "Clear my choice" radio button
    const validInputs = inputs.filter(input => {
      const parent = input.closest(".r0, .r1, div, tr, li, p") || input.parentElement;
      const idOrName = `${input.id || ""} ${input.name || ""} ${input.className || ""}`.toLowerCase();
      const parentText = clean(parent?.textContent || "").toLowerCase();

      const isClearChoice =
        input.classList.contains("clearchoice") ||
        parent?.classList.contains("clearchoice") ||
        idOrName.includes("clearchoice") ||
        input.value === "-1" ||
        parentText === "clear my choice" ||
        parentText.startsWith("clear my choice");
      return !isClearChoice;
    });

    const options = [];
    const optionsDetail = [];

    if (validInputs.length > 0) {
      validInputs.forEach((input, idx) => {
        const parent = input.closest(".r0, .r1, .form-check, tr, li, div") || input.parentElement;

        let labelEl = null;
        if (input.id) {
          try {
            labelEl = el.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          } catch (_) {}
        }
        if (!labelEl) {
          labelEl = input.closest("label") || parent?.querySelector("label");
        }

        // 1. Extract answernumber if present (e.g. "a. ", "A. ", "1. ")
        let numberText = "";
        const numEl = (labelEl || parent)?.querySelector(".answernumber, .optionnumber");
        if (numEl) {
          numberText = clean(numEl.textContent);
        }

        // 2. Extract choice text from label, excluding answernumber & input
        let text = "";
        if (labelEl) {
          const clone = labelEl.cloneNode(true);
          clone.querySelectorAll(".answernumber, .optionnumber, input").forEach(n => n.remove());
          text = clean(clone.innerText || clone.textContent);
        }

        // 3. Fallback: inspect parent row if label had no text
        if (!text && parent) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll("input, .answernumber, .optionnumber").forEach(n => n.remove());
          text = clean(clone.innerText || clone.textContent);
        }

        // 4. Fallback: direct textContent
        if (!text && labelEl) {
          text = clean(labelEl.textContent);
        }

        // 5. Determine option key/letter (A, B, C...)
        let key = "";
        if (numberText) {
          const match = numberText.match(/([a-zA-Z0-9]+)/);
          if (match) key = match[1].toUpperCase();
        }
        if (!key) {
          key = String.fromCharCode(65 + idx);
        }

        // Strip leading "a. ", "A. ", "1. ", "(a) ", etc. if still attached in text
        const strippedText = text.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim();
        const finalText = strippedText || text || `Option ${idx + 1}`;
        const fullOption = `${key}. ${finalText}`;

        options.push(fullOption);
        optionsDetail.push({
          index: idx,
          key,
          numberText,
          text: finalText,
          full: fullOption,
          inputId: input.id || null,
          value: input.value,
          checked: !!input.checked
        });
      });
    } else {
      // Fallback for select dropdowns or non-input option markup
      const select = answerContainer.querySelector("select");
      if (select) {
        [...select.options].forEach((opt, idx) => {
          const txt = clean(opt.textContent);
          if (txt && opt.value !== "") {
            const key = String.fromCharCode(65 + options.length);
            const full = `${key}. ${txt}`;
            options.push(full);
            optionsDetail.push({
              index: idx,
              key,
              text: txt,
              full,
              value: opt.value,
              inputId: select.id || null,
              checked: !!opt.selected
            });
          }
        });
      } else {
        // Fallback: look for .answer label, .answer .r0, .answer li
        const rawItems = [...answerContainer.querySelectorAll(".answer label, .answer .r0, .answer .r1, .answer li")];
        rawItems.forEach((item, idx) => {
          const txt = clean(item.innerText || item.textContent);
          const low = txt.toLowerCase();
          if (txt && !low.includes("clear my choice") && !low.startsWith("select one")) {
            const key = String.fromCharCode(65 + options.length);
            const stripped = txt.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, "").trim();
            const full = `${key}. ${stripped || txt}`;
            options.push(full);
            optionsDetail.push({
              index: idx,
              key,
              text: stripped || txt,
              full,
              value: String(idx),
              inputId: null,
              checked: false
            });
          }
        });
      }
    }

    return { options, optionsDetail };
  }

  function extract(el, index) {
    const qtext = el.querySelector(".qtext, .formulation .qtext, [class*='qtext']");
    const text = clean((qtext || el).innerText || (qtext || el).textContent);
    const type = g.AutoQuizClassifier ? g.AutoQuizClassifier.classify(el) : "multiple_choice";
    const inputs = [...el.querySelectorAll("input, textarea, select")];
    const { options, optionsDetail } = extractOptions(el);

    const normalizer = g.AutoQuizDB?.normalize || (t => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim());
    const qid = el.id || el.getAttribute("data-questionid") || `fallback-${index}-${normalizer(text).slice(0, 48)}`;
    const current = inputs.map(i => ({
      type: i.type || i.tagName.toLowerCase(),
      value: i.value,
      checked: !!i.checked
    }));

    const path = typeof location !== "undefined" ? location.pathname : "";

    return {
      id: qid,
      number: index + 1,
      type,
      questionType: type,
      text,
      question: text,
      options,
      choices: options, // alias for backwards compatibility
      optionsDetail,
      inputs: inputs.length,
      currentAnswer: current,
      page: path
    };
  }

  g.AutoQuizExtractor = { extract, extractOptions };
})(typeof globalThis !== "undefined" ? globalThis : this);
