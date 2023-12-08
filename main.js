// FUA
    // add code below the table parsing to examine the txt.body after the table we just iterated over of class="txt-body"
    // check whether other possible elit file formats that dont fit this specified mold
    // add further code under body content
    // format final output text to be as easy to read as possible using pure html and css and ask gpt to help me format this
    // allow the extension to run when the button is clicked

// -------------------- THIS CODE GOES IN CHRONOLOGICAL ORDER --------------------

// ---------- HEADER ----------

var page = {
    caseTitle: "",
    caseNumber: "",
    caseDate: "",
    caseTribunalCourt: "",
    caseCoram: "",
    caseCounsel: "",
    caseParties: "",
    caseFacts: "",
    caseJudgmentConclusion: ""
};

var count = 0;

var a = document.querySelector(".caseTitle");
// a.style.backgroundColor = "yellow";
page.caseTitle = a.textContent.trim();

var infoTable = document.querySelector("#info-table");
// infoTable.style.backgroundColor = "yellow";
for (var i=0; i < infoTable.rows.length; i++) {
    var cells = infoTable.rows[i].cells;
    for (var q=0; q< cells.length; q++) {
        // console.log(`i is ${i} and q is ${q} and ${cells[q].innerText}`);
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
        } else if (i === 6 && q === 2) {
            page.caseFacts = cells[q].innerText;
        } else if (i === 7 && q === 2) {
            page.caseJudgmentConclusion = cells[q].innerText;
        } else {
            console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
        }
    }
}

/* 
alert(`This case is called ${page.caseTitle}`);
alert(`This case date is ${page.caseDate}`);
alert(`This case tribunal and courts is ${page.caseTribunalCourt}`);
alert(`This case coram is ${page.caseCoram}`);
alert(`This case counsel is ${page.caseCounsel}`);
alert(`The case parties are ${page.caseParties}`);
*/

// ---------- BODY CONTENT -----------

var imp = document.querySelectorAll(".Judg-Heading-1");
imp.forEach(function (paragraph) {
    switch (paragraph.textContent.trim()) {
        case "Introduction":
            paragraph.style.backgroundColor = "yellow";
            break;
        case "The decision in the court below":
            break;
        case "Factual background":
            paragraph.style.backgroundColor = "yellow";
            break
        case "Our decision":
            break
        case "Judgment":
            paragraph.style.backgroundColor = "yellow";
            break;
        case "Conclusion":
            paragraph.style.backgroundColor = "yellow";
            break;
        default:
            count += 1
            console.log(`Edge case ${String(count).padStart(3,'0')} hit. Report any issues to @gongahkia.`);
            console.log(`Heading found: ${paragraph.textContent.trim()}`);
    }
});
