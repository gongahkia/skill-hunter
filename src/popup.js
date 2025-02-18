let currentQuestion, currentQuestionId;

document.addEventListener('DOMContentLoaded', function() {
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
        document.getElementById('result').textContent = "Correct! You can now access the LLM.";
        chrome.storage.local.set({lastSolvedTime: Date.now()}, function() {
          setTimeout(() => window.close(), 2000);
        });
      } else {
        document.getElementById('result').textContent = "Incorrect. Please try again.";
      }
    });
  });
});
