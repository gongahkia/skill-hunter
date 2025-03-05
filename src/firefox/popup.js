let currentQuestion, currentQuestionId, originalUrl, currentQuestionTitle;

const successMessage = "Correct! You can now access the AI Chatbot for the next 15 minutes. Redirecting you now.";
const failureMessage = "Incorrect. Please try again. Reload the page to get a different question.";

document.addEventListener('DOMContentLoaded', async function() {
    const result = await browser.storage.local.get(['originalUrl']);
    originalUrl = result.originalUrl;
    const response = await browser.runtime.sendMessage({action: "getRandomQuestion"});
    currentQuestion = response.question;
    currentQuestionId = response.id;
    currentQuestionTitle = response.title;
    document.getElementById('question').textContent = currentQuestionTitle; 
    document.getElementById('question_content').innerHTML = currentQuestion; 
    document.getElementById('submit').addEventListener('click', async function() {
        const solution = document.getElementById('solution').value;
        const response = await browser.runtime.sendMessage({
            action: "checkAnswer",
            userAnswer: solution,
            question: currentQuestion,
            id: currentQuestionId
        });
        if (response.isCorrect) {
            document.getElementById('result').textContent = successMessage;
            await browser.storage.local.set({lastSolvedTime: Date.now()});
            setTimeout(async () => {
                await browser.runtime.sendMessage({action: "redirectToOriginal"});
                window.close();
            }, 2000);
        } else {
            document.getElementById('result').textContent = failureMessage;
        }
    });
});