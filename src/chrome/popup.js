let currentQuestion, currentQuestionId, originalUrl, currentQuestionTitle, currentQuestionSlug;

document.addEventListener('DOMContentLoaded', async function() {
    chrome.storage.local.get(['originalUrl'], function(result) {
        originalUrl = result.originalUrl;
    });

    chrome.runtime.sendMessage({action: "getRandomQuestion"}, function(response) {
        currentQuestion = response.question;
        currentQuestionId = response.id;
        currentQuestionTitle = response.title;
        currentQuestionSlug = response.slug; 
        document.getElementById('question').textContent = currentQuestionTitle; 
        document.getElementById('question_content').innerHTML = currentQuestion; 
    });

    document.getElementById('submit').addEventListener('click', function() {
        chrome.storage.local.set({ 
            lastSubmittedSolution: "",
            lastQuestionSlug: currentQuestionSlug
        }, function() {
            const leetCodeUrl = `https://leetcode.com/problems/${currentQuestionSlug}/description`;
            chrome.tabs.create({ url: leetCodeUrl });
            window.close();
        });
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updatePopup") {
        const resultDiv = document.getElementById("result");
        resultDiv.textContent = message.content;
        resultDiv.style.backgroundColor = "#e7f4e7"; 
        const header = document.getElementById("declaration_of_war");
        const question = document.getElementById("question");
        const questionContent = document.getElementById("question_content");
        const questionSection = document.getElementById("question_section");
        const submitButton = document.getElementById("submit");
        if (header && question && questionContent && questionSection && submitButton) {
            console.log("Removing elements");
            header.remove();
            question.remove();
            questionContent.remove();
            questionSection.remove();
            submitButton.remove();
        } else {
            console.error("Elements not found");
        }
    }
});