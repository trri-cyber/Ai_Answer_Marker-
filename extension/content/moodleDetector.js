(function(g){
 function detect(){const quizRoot=document.querySelector("#page-mod-quiz-attempt, form#responseform, .que");const questions=[...document.querySelectorAll(".que")];const isMoodle=!!(quizRoot&&questions.length);return{isMoodle,questions,root:quizRoot};}
 g.AutoQuizMoodleDetector={detect};
})(globalThis);
