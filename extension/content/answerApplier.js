(function(g) {
  function clean(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function apply(questionEl, answer) {
    const rawAnswer = String(answer ?? "").trim();
    if (!rawAnswer) throw new Error("No answer to apply.");

    const wantedList = (Array.isArray(answer) ? answer : [rawAnswer]).map(w => String(w).trim()).filter(Boolean);

    // 1. Radio & Checkbox inputs (Multiple Choice, True/False, Multiple Select)
    const radios = [...questionEl.querySelectorAll('input[type="radio"]')];
    const checks = [...questionEl.querySelectorAll('input[type="checkbox"]')];
    const inputs = [...radios, ...checks].filter(input => {
      const parent = input.closest(".r0, .r1, div, tr, li") || input.parentElement;
      const isClear =
        input.classList.contains("clearchoice") ||
        parent?.classList.contains("clearchoice") ||
        (input.id && input.id.toLowerCase().includes("clearchoice")) ||
        input.value === "-1" ||
        clean(parent?.textContent) === "clear my choice";
      return !isClear;
    });

    if (inputs.length > 0) {
      let matchedCount = 0;

      const candidates = inputs.map((input, idx) => {
        const parent = input.closest(".r0, .r1, .form-check, tr, li, div") || input.parentElement;
        let labelEl = null;
        if (input.id) {
          try {
            labelEl = questionEl.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          } catch (_) {}
        }
        if (!labelEl) {
          labelEl = input.closest("label") || parent?.querySelector("label");
        }

        const numEl = (labelEl || parent)?.querySelector(".answernumber, .optionnumber");
        const numberText = numEl ? numEl.textContent.trim() : "";
        let letter = "";
        if (numberText) {
          const m = numberText.match(/([a-zA-Z0-9]+)/);
          if (m) letter = m[1].toLowerCase();
        }
        if (!letter) {
          letter = String.fromCharCode(97 + idx); // a, b, c...
        }

        let labelText = "";
        if (labelEl) {
          const clone = labelEl.cloneNode(true);
          clone.querySelectorAll(".answernumber, .optionnumber, input").forEach(n => n.remove());
          labelText = clone.innerText || clone.textContent || "";
        }
        if (!labelText && parent) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll("input, .answernumber, .optionnumber").forEach(n => n.remove());
          labelText = clone.innerText || clone.textContent || "";
        }

        const rawClean = clean(labelText);
        const strippedClean = clean(labelText.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, ""));

        return {
          input,
          labelEl,
          parent,
          letter,
          rawClean,
          strippedClean
        };
      });

      for (const wanted of wantedList) {
        const wClean = clean(wanted);
        const wStripped = clean(wanted.replace(/^(\(?[a-zA-Z0-9]+[\.\)\:\-]\s*)/, ""));
        const letterMatch = wanted.trim().match(/^([a-zA-Z])([\.\)\:\s]|$)/);
        const targetLetter = letterMatch ? letterMatch[1].toLowerCase() : null;

        const matchedCandidate = candidates.find(c => {
          // 1. Exact match on stripped text
          if (wStripped && c.strippedClean && wStripped === c.strippedClean) return true;
          // 2. Exact match on raw clean text
          if (wClean && c.rawClean && wClean === c.rawClean) return true;
          // 3. Option letter match (e.g. answer is "B" or "b." and candidate letter is "b")
          if (targetLetter && c.letter === targetLetter) return true;
          // 4. Substring containment
          if (wStripped.length >= 3 && c.strippedClean.includes(wStripped)) return true;
          if (c.strippedClean.length >= 3 && wStripped.includes(c.strippedClean)) return true;
          return false;
        });

        if (matchedCandidate) {
          const { input, labelEl } = matchedCandidate;

          if (input.type === "checkbox") {
            // For checkboxes: only click if not already checked (click toggles)
            if (!input.checked) {
              input.click();
            }
            // Ensure checked state and fire events regardless
            if (!input.checked) {
              input.checked = true;
            }
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            // For radio buttons: set checked then fire events
            input.checked = true;
            input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            if (labelEl) {
              labelEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }
          }
          matchedCount++;
        }
      }

      if (!matchedCount) {
        throw new Error(`Could not match "${rawAnswer}" to any available Moodle option.`);
      }

      return { applied: true, matched: matchedCount };
    }

    // 2. Textarea or Text Input (Short Answer, Numerical, Essay)
    const field = questionEl.querySelector("textarea, input[type='text'], input[type='number'], input:not([type])");
    if (field) {
      field.focus();
      field.value = rawAnswer;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      return { applied: true, matched: 1 };
    }

    throw new Error("This question type is not supported for direct application.");
  }

  g.AutoQuizAnswerApplier = { apply };
})(typeof globalThis !== "undefined" ? globalThis : this);
