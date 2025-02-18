let currentQuestion, currentQuestionId, originalUrl;

const successMessage = "Correct! You can now access the LLM for the next 15 minutes. Redirecting you now.";
const failureMessage = "Incorrect. Please try again. Reload the page to get a different question.";

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['originalUrl'], function(result) {
    originalUrl = result.originalUrl;
  });

  chrome.runtime.sendMessage({action: "getRandomQuestion"}, function(response) {
    currentQuestion = response.question;
    currentQuestionId = response.id;
    document.getElementById('question').textContent = currentQuestion;
  });

  document.getElementById('submit').addEventListener('click', function() {
    const solution = document.getElementById('solution').value;
    chrome.runtime.sendMessage({
      action: "checkAnswer", 
      userAnswer: solution, 
      question: currentQuestion,
      id: currentQuestionId
    }, function(response) {
      if (response.isCorrect) {
        document.getElementById('result').textContent = successMessage;
        chrome.storage.local.set({lastSolvedTime: Date.now()}, function() {
          setTimeout(() => {
            chrome.runtime.sendMessage({action: "redirectToOriginal"}, function() {
              window.close();
            });
          }, 2000);
        });
      } else {
        document.getElementById('result').textContent = failureMessage;
      }
    });
  });
});