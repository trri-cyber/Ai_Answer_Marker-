import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

// Load content scripts into a JSDOM window
function createMoodleEnv() {
  const html = fs.readFileSync(path.resolve("tests/fixtures/moodle.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://moodle.example.edu/mod/quiz/attempt.php?attempt=123" });
  const window = dom.window;

  // Load detector, classifier, extractor, answerApplier, harvester
  const detectorCode = fs.readFileSync(path.resolve("extension/content/moodleDetector.js"), "utf8");
  const classifierCode = fs.readFileSync(path.resolve("extension/content/questionClassifier.js"), "utf8");
  const extractorCode = fs.readFileSync(path.resolve("extension/content/questionExtractor.js"), "utf8");
  const applierCode = fs.readFileSync(path.resolve("extension/content/answerApplier.js"), "utf8");
  const harvesterCode = fs.readFileSync(path.resolve("extension/content/reviewHarvester.js"), "utf8");

  window.eval(detectorCode);
  window.eval(classifierCode);
  window.eval(extractorCode);
  window.eval(applierCode);
  window.eval(harvesterCode);

  return window;
}

function createReviewEnv() {
  const html = fs.readFileSync(path.resolve("tests/fixtures/moodle_review.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://moodle.example.edu/mod/quiz/review.php?attempt=123" });
  const window = dom.window;

  const detectorCode = fs.readFileSync(path.resolve("extension/content/moodleDetector.js"), "utf8");
  const classifierCode = fs.readFileSync(path.resolve("extension/content/questionClassifier.js"), "utf8");
  const extractorCode = fs.readFileSync(path.resolve("extension/content/questionExtractor.js"), "utf8");
  const harvesterCode = fs.readFileSync(path.resolve("extension/content/reviewHarvester.js"), "utf8");

  window.eval(detectorCode);
  window.eval(classifierCode);
  window.eval(extractorCode);
  window.eval(harvesterCode);

  return window;
}

describe("Moodle Question and Option Extractor", () => {
  it("extracts Boost theme MCQ options accurately and excludes Clear my choice", () => {
    const window = createMoodleEnv();
    const q1 = window.document.getElementById("q1");

    const extracted = window.AutoQuizExtractor.extract(q1, 0);

    expect(extracted.text).toContain("Which language runs in a web browser?");
    expect(extracted.type).toBe("multiple_choice");
    expect(extracted.options).toHaveLength(2);
    expect(extracted.options[0]).toBe("A. Python");
    expect(extracted.options[1]).toBe("B. JavaScript");

    const allOptionsText = extracted.options.join(" ");
    expect(allOptionsText.toLowerCase()).not.toContain("clear my choice");
  });

  it("extracts Table-based MCQ options accurately", () => {
    const window = createMoodleEnv();
    const q2 = window.document.getElementById("q2");

    const extracted = window.AutoQuizExtractor.extract(q2, 1);

    expect(extracted.text).toContain("What is the capital of France?");
    expect(extracted.options).toHaveLength(2);
    expect(extracted.options[0]).toBe("A. Berlin");
    expect(extracted.options[1]).toBe("B. Paris");
  });

  it("extracts multiple select checkboxes accurately", () => {
    const window = createMoodleEnv();
    const q3 = window.document.getElementById("q3");

    const extracted = window.AutoQuizExtractor.extract(q3, 2);

    expect(extracted.type).toBe("multiple_select");
    expect(extracted.options).toHaveLength(3);
    expect(extracted.options[0]).toBe("A. 2");
    expect(extracted.options[1]).toBe("B. 4");
    expect(extracted.options[2]).toBe("C. 5");
  });

  it("applies answers to Boost MCQ correctly", () => {
    const window = createMoodleEnv();
    const q1 = window.document.getElementById("q1");

    const result = window.AutoQuizAnswerApplier.apply(q1, "JavaScript");
    expect(result.applied).toBe(true);

    const jsInput = window.document.getElementById("q1:1_answer1");
    expect(jsInput.checked).toBe(true);
  });

  it("applies answers by option letter correctly", () => {
    const window = createMoodleEnv();
    const q2 = window.document.getElementById("q2");

    const result = window.AutoQuizAnswerApplier.apply(q2, "B");
    expect(result.applied).toBe(true);

    const parisInput = window.document.getElementById("q2:1_answer1");
    expect(parisInput.checked).toBe(true);
  });
});

describe("Moodle Review Auto-Learning Harvester", () => {
  it("detects review page correctly", () => {
    const window = createReviewEnv();
    const detection = window.AutoQuizMoodleDetector.detect();

    expect(detection.isMoodle).toBe(true);
    expect(detection.isReview).toBe(true);
    expect(detection.questions).toHaveLength(3);
  });

  it("extracts confirmed correct answer from .rightanswer element", () => {
    const window = createReviewEnv();
    const rq1 = window.document.getElementById("rq1");

    const answer = window.AutoQuizHarvester.extractCorrectAnswer(rq1);
    expect(answer).toBe("JavaScript");
  });

  it("extracts confirmed correct answer from .correct class row", () => {
    const window = createReviewEnv();
    const rq2 = window.document.getElementById("rq2");

    const answer = window.AutoQuizHarvester.extractCorrectAnswer(rq2);
    expect(answer).toBe("Paris");
  });

  it("extracts confirmed correct answer from True/False question with quotes", () => {
    const window = createReviewEnv();
    const rq3 = window.document.getElementById("rq3");

    const answer = window.AutoQuizHarvester.extractCorrectAnswer(rq3);
    expect(answer).toBe("False");
  });
});
