let currentQuestion, currentQuestionId, originalUrl, currentQuestionTitle;

const successMessage = "Correct! You can now access the AI Chatbot for the next 15 minutes. Redirecting you now.";
const failureMessage = "Incorrect. Please try again.";

document.addEventListener('DOMContentLoaded', async function() {
    const result = await browser.storage.local.get(['originalUrl']);
    originalUrl = result.originalUrl;

    const response = await browser.runtime.sendMessage({action: "getLeetCodeQuestion"});
    currentQuestion = response.question;
    currentQuestionId = response.question_id;
    currentQuestionTitle = response.question_title;

    document.getElementById('question').textContent = currentQuestionTitle; // Changed to questionTitle for a better display
    document.getElementById('question_content').textContent = currentQuestion; // To render HTML content

    document.getElementById('submit').addEventListener('click', async function() {
        const solution = document.getElementById('solution').value;

        const response = await browser.runtime.sendMessage({
            action: "submitSolution",
            solution: solution,
            question_id: currentQuestionId
        });

        if (response.result.success) {
            document.getElementById('result').textContent = successMessage;
            await browser.storage.local.set({lastSolvedTime: Date.now()});
            setTimeout(async () => {
                await browser.runtime.sendMessage({action: "redirectToOriginal"});
                window.close();
            }, 2000);
        } else {
            document.getElementById('result').textContent = failureMessage + " " + response.result.error;
        }
    });
});