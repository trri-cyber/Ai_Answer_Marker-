(function(g) {
  function detect() {
    const quizRoot = document.querySelector("#page-mod-quiz-attempt, #page-mod-quiz-review, form#responseform, .que");
    const questions = [...document.querySelectorAll(".que")];
    const pathname = typeof location !== "undefined" ? location.pathname : "";
    const isReview =
      !!document.querySelector("#page-mod-quiz-review, .rightanswer, .outcome") ||
      pathname.includes("review.php");
    const isAttempt =
      !!document.querySelector("#page-mod-quiz-attempt, form#responseform") ||
      pathname.includes("attempt.php");
    const isMoodle = !!(quizRoot && questions.length);

    return {
      isMoodle,
      isReview,
      isAttempt: !isReview && (isAttempt || isMoodle),
      questions,
      root: quizRoot
    };
  }

  g.AutoQuizMoodleDetector = { detect };
})(typeof globalThis !== "undefined" ? globalThis : this);
