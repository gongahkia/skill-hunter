[![](https://img.shields.io/badge/dorso_1.0.0-passing-dark_green)](https://github.com/gongahkia/dorso/releases/tag/1.0.0)
[![](https://img.shields.io/badge/dorso_2.0.0-passing-green)](https://github.com/gongahkia/dorso/releases/tag/2.0.0)

# `Dorso` 🧠

CAPTCHA but to catch braindead programmers instead of bots.

## Rationale

The software development experience in 2025 involves reaching for the closest AI chatbot available, then battling the urge to [punt your laptop across the room](https://media1.tenor.com/m/nJW6x9jzp1AAAAAC/mob-psycho100-mob-psycho.gif) when the chatbot can't understand your poorly worded prompt.

Worried that the convenience and availability of web-based AI chatbots were [making programmers dumber](https://andrewzuo.com/is-ai-making-programmers-stupid-115e9d6e7460), I created `Dorso`.

`Dorso` is a client-sided browser extension that monitors web activity and forces users to correctly answer a **Leetcode question** before allowing them access to their [AI chatbot](#details) of choice for the next 15 minutes.

## Screenshot

![](./asset/reference/5.png)
![](./asset/reference/6.png)

## Details

### Supported browsers

Find `Dorso` on the [Chrome Web Store](https://chromewebstore.google.com) or [Firefox browser Add-ons](https://addons.mozilla.org/en-US/firefox/).

| Browser | Status | Link |
| :--- | :--- | :--- | 
| Google Chrome | ![](https://img.shields.io/badge/Status-Awaiting%20Approval-orange) | ... | 
| Firefox | ![](https://img.shields.io/badge/Status-Up-brightgreen) | [addons.mozilla.org/en-US/firefox/addon/dorso/](https://addons.mozilla.org/en-US/firefox/addon/dorso/) |
| Safari | ![](https://img.shields.io/badge/Status-Unsupported-red) | NIL | 

### Blacklist

`Dorso` checks for web-based AI chatbot access off the following blacklist.

* https://chatgpt.com/
* https://www.perplexity.ai/
* https://gemini.google.com/app
* https://claude.ai/
* https://www.deepseek.com/
* https://copilot.microsoft.com/
* https://socrat.ai/
* https://huggingface.co/chat/
* https://writesonic.com/chat
* https://you.com/
* https://www.jasper.ai/

## Architecture

```mermaid
sequenceDiagram
    participant User
    participant Popup as popup.html & popup.js
    participant Background as background.js
    participant LeetCode as LeetCode Website
    participant FastAPI as FastAPI API (main.py)

    User ->> Popup: Opens extension popup
    Popup ->> Background: Requests random question (getRandomQuestion)
    Background ->> LeetCode: Fetches question via GraphQL API
    LeetCode -->> Background: Returns question data (title, slug, content)
    Background -->> Popup: Sends question data to display

    User ->> Popup: Clicks "Submit"
    Popup ->> Background: Stores lastSubmittedSolution & lastQuestionSlug
    Popup ->> LeetCode: Redirects to problem page

    Note over User,LeetCode: User submits solution on LeetCode

    LeetCode ->> ContentScript as leetcode-content.js: Displays submission result
    ContentScript ->> Background: Sends result (success/failure) via runtime message

    alt Submission successful
        Background ->> Popup: Updates popup with success message
        Background ->> Browser: Enables AI access for 15 minutes
        Background ->> Browser Storage: Updates lastSolvedTime
    else Submission failed
        Background ->> Popup: Updates popup with failure message
    end

    Note over ContentScript,FastAPI: FastAPI validates and tests solution code

    ContentScript ->> FastAPI: Sends solution for validation (/leetcode/submit)
    FastAPI -->> ContentScript: Returns validation result (pass/fail)
```

## Usage

The below instructions are for locally running `Dorso`.

| Browser | Status | 
| :--- | :--- |
| Firefox | ![](https://img.shields.io/badge/Status-Up-brightgreen) | 
| Google Chrome | ![](https://img.shields.io/badge/Status-Up-brightgreen) | 
| Safari | ![](https://img.shields.io/badge/Status-Unsupported-red) | 

### Firefox

1. Run the below commands.

```console
$ git clone https://github.com/gongahkia/dorso
$ cd dorso
$ make firefox
$ cd backend
$ uvicorn main:app --reload
```
  
2. Copy and paste this link in the search bar *`about:debugging#/runtime/this-firefox`*.
3. Click *load temporary add-on*.
4. Open the `dorso` folder, select `manifest.json`.
5. Open any Web-based AI Chatbot. 

### Chrome

1. Run the below commands.

```console
$ git clone https://github.com/gongahkia/dorso
$ cd dorso
$ make chrome
$ cd backend
$ uvicorn main:app --reload
```

2. Copy and paste this link in the search bar *`chrome://extensions/`*.
3. Toggle *Developer mode* on.
4. Click *load unpacked*.
5. Open the `dorso` folder, click *select*.
6. Open any Web-based AI Chatbot.

## References

The name `Dorso` is in reference to the [dorsolateral prefrontal cortex](https://en.wikipedia.org/wiki/Dorsolateral_prefrontal_cortex), the portion of the brain primarily responsible for solving programming problems.

![](./asset/logo/think.jpg)
