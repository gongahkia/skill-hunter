// -------------------- THIS CODE GOES IN CHRONOLOGICAL ORDER --------------------

// ---------- UNIVERSAL HEADER ---------- DONE!!!

var page = {
    caseTitle: "",
    caseNumber: "",
    caseDate: "",
    caseTribunalCourt: "",
    caseCoram: "",
    caseCounsel: "",
    caseParties: "",
    caseLegalIssues: [],
    caseBody: {}
};

var count = 0;

// case title
var a = document.querySelector(".caseTitle");
// a.style.backgroundColor = "green";
page.caseTitle = a.textContent.trim();

// case summary data
var infoTable = document.querySelector("#info-table");
// infoTable.style.backgroundColor = "yellow";
for (var i=0; i < infoTable.rows.length; i++) {
    var cells = infoTable.rows[i].cells;
    for (var q=0; q< cells.length; q++) {
        if (i === 0 && q === 2) {
            page.caseNumber = cells[q].innerText;
        } else if (i === 1 && q === 2) {
            page.caseDate = cells[q].innerText;
        } else if (i === 2 && q === 2) {
            page.caseTribunalCourt = cells[q].innerText;
        } else if (i === 3 && q === 2) {
            page.caseCoram = cells[q].innerText;
        } else if (i === 4 && q === 2) {
            page.caseCounsel = cells[q].innerText;
        } else if (i === 5 && q === 2) {
            page.caseParties = cells[q].innerText;
        } else {
            // console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
            // console.log(`Incorrect number of arguments for case summary table. Logged 'i':${i}, 'q':${q}.`);
        }
    }
}

// case legal issues
var legalIssues = document.querySelector("div.txt-body");
// legalIssues.style.backgroundColor = "magenta";
if (legalIssues) {
    legalIssues.childNodes.forEach((childNode) => {
        if (childNode.nodeType === 1 && childNode.textContent != "") {
            page.caseLegalIssues.push(childNode.textContent.trim());
        }
    });
} else {
    // console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
    // console.log("No legal issues found.");
}

// console.log(`Case title: ${page.caseTitle}\nCase date: ${page.caseDate}\nCase tribunal / Courts: ${page.caseTribunalCourt}\nCase coram: ${page.caseCoram}\nCase counsel: ${page.caseCounsel}\nCase parties: ${page.caseParties}\nCase legal issues: ${page.caseLegalIssues}`);

// ---------- SPECIFIC BODY CONTENT ----------- DONE!!!

function secNumberCheck(a) {
    return /^\d/.test(a);
}

var imp = document.querySelectorAll("p");
var secName = "";
var buffer = [];
imp.forEach(function(paragraph) {
    if (paragraph.classList.contains("Judg-Heading-1")) {
        if (secName === "") {
            secName = paragraph.textContent.trim();
        } else {
            page.caseBody[secName] = buffer;
            secName = paragraph.textContent.trim();
            // alert(buffer);
            buffer = [];
        }
        // paragraph.style.backgroundColor = "yellow";
    } else if (paragraph.classList.contains("Judg-1")) { 
        if (secNumberCheck(paragraph.textContent.trim())) {
            // paragraph.style.backgroundColor = "blue";
            buffer.push(paragraph.textContent.trim());
        }
    } else {
        count += 1;
        // console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
        // console.log("Unexpected conditional case hit.");
    }
});
page.caseBody[secName] = buffer;

// ---------- FRONT-END CREATION ---------- DONE!!!

function sanitise(b) {
    return b.replace(/^\s*\d+\s*/gm, "");
}

function addSection(sum, deets) {
    var mainEl = document.getElementById("dynamic-body");
    var deetEl = document.createElement("details");
    var sumEl = document.createElement("summary");
    var deetContentEl = document.createElement("p");
    sumEl.textContent = sum;
    deetContentEl.innerHTML = deets;
    deetEl.appendChild(sumEl);
    deetEl.appendChild(deetContentEl);
    mainEl.appendChild(deetEl);
}

function simplifyContent(page) {
    var backup = document.body.innerHTML;
    var secNum = 0;
    var styleContent = `
    body {
        font-family: 'Arial', sans-serif;
        background-color: #f8f8f8;
        color: #333;
        margin: 0;
        padding: 0;
    }

    header {
        background-color: #333;
        color: #fff;
        text-align: center;
        padding: 1em;
    }

    main {
        max-width: 800px;
        margin: 2em auto;
        padding: 1em;
        background-color: #fff;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }

    .line {
        margin-bottom: 1em;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.5em;
    }

    details {
        margin-bottom: 1em;
    }

    summary {
        cursor: pointer;
        font-weight: bold;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.5em;
        margin-bottom: 0.5em;
        outline: none;
    }

    details > p {
        margin-top: 0;
    }

    .github-credit {
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 12px;
        color: #555;
    }`
    ;

    document.body.innerHTML = `
    <header>
        <h1 id="dynamic-header"></h1>
    </header>

    <main id="dynamic-body">
        <div class="line" id="case-num"></div>
        <div class="line" id="case-date"></div>
        <div class="line" id="case-tribunal-court"></div>
        <div class="line" id="case-coram"></div>
        <div class="line" id="case-counsel"></div>
        <div class="line" id="case-parties"></div>
        <div class="line" id="case-legal-issues"></div>
    </main>

    <div class="github-credit">
        Designed and built by <a href="https://gongahkia.github.io/">Gabriel Ong</a> | <a href="https://github.com/gongahkia/judgeman">Source</a>
    </div>
    `;
    document.title = "Judgeman";

    var styleEl = document.querySelector("style");
    if (styleEl) {
        styleEl.innerHTML = styleContent;
    } else {
        var newStyleEl = document.createElement("style");
        newStyleEl.innerHTML = styleContent;
        document.head.appendChild(newStyleEl);
    }

    var caseNumber = document.getElementById("case-num");
    caseNumber.innerHTML = `<b>Case number:</b> ${page.caseNumber}`;
    var caseDate = document.getElementById("case-date");
    caseDate.innerHTML = `<b>Date: </b> ${page.caseDate}`;
    var caseTribunalCourt = document.getElementById("case-tribunal-court");
    caseTribunalCourt.innerHTML = `<b>Tribunal / Court: </b> ${page.caseTribunalCourt}`;
    var caseCoram = document.getElementById("case-coram");
    caseCoram.innerHTML = `<b>Coram: </b> ${page.caseCoram}`;
    var caseCounsel = document.getElementById("case-counsel");
    caseCounsel.innerHTML = `<b>Counsel: </b> ${page.caseCounsel}`;
    var caseParties = document.getElementById("case-parties");
    caseParties.innerHTML = `<b>Parties: </b> ${page.caseParties}`;
    var caseLegalIssuesArray = document.getElementById("case-legal-issues");
    caseLegalIssuesArray.innerHTML = `<b>Legal issues: </b><ul>${page.caseLegalIssues.map(function(legalIssue) { return `<li>${legalIssue}</li>`; }).join("")}</ul>`;
    
    caseTitle = page.caseTitle;
    var dynHead = document.getElementById("dynamic-header");
    dynHead.textContent = caseTitle;

    caseBodyArray = page.caseBody;
    for (el in caseBodyArray) {
        buf = "";
        for (var q=0; q < caseBodyArray[el].length; q++) {
            secNum += 1;
            buf += `<p>${secNum}.&emsp;${sanitise(caseBodyArray[el][q])}</p>`;
        }
        addSection(el, buf);
    }

    return backup;
}

function restoreContent(backup) {
    document.body.innerHTML = backup || "";
}

simplifiedState = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.toggle) {
    if (simplifiedState) {
        restoreContent(backup);
        simplifiedState = false;
    } else {
        backup = simplifyContent(page);
        simplifiedState = true;
    }
  }
});
