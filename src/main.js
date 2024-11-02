/*
FUA 
    * edit manifest.json further later
    * rewrite existing functionality from the groundup, of defining certain words within statutes inline 
        * add further support to seperate and store part numbers and part headers in the created json
    * add additional URL links so those words can be clicked to be brought to the definition section
    * implement a stronger word check within a function to extract definitions from their speciifed words and attach words to their meanings
    * add rendering code so that when logical connecting words like "and", "or" etc. (ask GPT for others) are displayed in a defintion, they are bolded and italicised to show emphasis
    * consider restricting how much the user is able to be shown at any given type
        * instead of seeing a whole statute the script will show specific sections at any given time
        * this also make it easier for the scraper to reformat and define things in line
        * if adopting this approach, edit the regex content_matching urls in manifest.json
    * learn how background workers in manifest v3 work and consider integrating a background script as necessary
    * add an outline / minimap of each section and subsection at the side of the webpage that has clickable links so users can easily navigate statutes
    * integrate further functionality such as 
        * statutes referenced within other statutes can be linked and their respective URLs will be clickable as well
        * mention of a given limb or section dependent on other sections will also be clickable, can be brought to that dependent section immediately
        * allow statutes and their composite sections and subsections to fold accordingly
    * rewrite the frontend to be pretty and minimal with nice smooth animations 
    * consider keeping the display discrete and include a minimal and complex view that expands out to show all hidden details, minimal view should avoid distracting the user as far as possible
    * consider centralising the pop-up button 
    * also consider directly rendering the button as a component onto the screen that can then be clicked if need be, see createGenericButton() function
    * consider adding a local notepad that users can use to save specific statutes or an AI integration that explains what a given statute means to users
    * add a script or automated browser program (perhaps with playwright or selenium) that opens the user's local browser and handles AUTOMATIC INSTALLATION of skill_hunter for them, and ask GPT for help implementing this if idk how
    * allow user customisation via specification of additional configurations within a local .json file users can place in the same directory as the manifest.json
        * add serialising and deserialising functions to read this config.json
        * add documentation for what can be customised in the README.md
    * add other colorschemes and font customisation such as
        * dark mode
        * light mode
        * gruvbox
        * everforest
        * etc. (see more colorschemes from vsc)
        * arial
        * times new roman
        * comic sans
    * clean up the description, screenshots and installation instructions in the README.md
    * HARD DEADLINE 15 Nov to get skill_hunter up and running, email Jerrold Soh then to sell my app and harvest free classpart if possible
    * test to ensure the browser extension runs on all statutes including longer ones like the Penal Code
    * integrate scraping using playwright if possible, otherwise look into continue using the HTML DOM API to access fields immediatly
    * look into other JS libraries for parsing dom structure and making the UI look better 
    * test out functionality of browser extension on the following browsers, then specify which browsers the extension is functional for in the README.md under browser support
        * google chrome
        * microsoft edge
        * brave
        * opera
        * mozilla firefox 
        * safari (come up with a browser-specific version for portability and runnability on macs if required)
*/

// ~~~~~~~~~~ CODE STARTS HERE ~~~~~~~~~~

// ~~~~~ HELPER FUNCTIONS ~~~~~

function deserialiseJSON(inp_json) {
    /*
    deserialises a JSON string for easy 
    debugging
    */
    return JSON.stringify(inp_json, null, 4)
}

// ~~~~~ SCRAPE DATA ~~~~~

function getPageMetadata() {
    /*
    returns basic metadata about the 
    current webpage
    */
    const title = document.title;
    const url = window.location.href;
    const characterSet = document.characterSet; // note that document.charset is now deprecated
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const description = descriptionMeta ? descriptionMeta.content : '';
    // const htmlBody = document.body.innerHTML; // ignoring this right now because it makes the returned JSON way too long
    const logoRef = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    const logoLink = logoRef ? logoRef.href : '';
    return {
        url,
        title,
        logoLink,
        characterSet,
        description
        // htmlBody
    };
}

function getPageBasicData() {
    /*
    returns metadata and other non-vital
    information about the current webpage
    */
    pageMetadata = getPageMetadata()
    const header = document.querySelector('div#nav.affix div#topLeftPanel');
    linkedTableOfContents = []
    if (header) {
        legislationTitle = header.querySelector('div.legis-title')?.innerText.trim();
        legislationPdfLink = header.querySelector('span.fa.fa-file-pdf-o').parentElement.href.trim();
        legislationStatus = header.querySelector('div.status-value')?.innerText.trim();
    } else {
        legislationTitle = ""
        legislationPdfLink = ""
        legislationStatus = ""
    }
    const tableOfContents = document.querySelector('div#tocPanel.toc-panel div#tocNav nav#toc')
    if (tableOfContents) {
        elementArray = tableOfContents.querySelectorAll('a.nav-link')
        if (elementArray) {
            for (el of elementArray){
                linkedTableOfContents.push(
                    {
                        "referenceText": el.innerText.trim(),
                        "referenceUrl": el.href.trim()
                    }
                )
            }
        }
    }
    return {
        "pageMetadata": pageMetadata,
        "pageBasicData": {
            "legislationTitle": legislationTitle,
            "legislationPDFDownloadLink": legislationPdfLink,
            "legislationStatus": legislationStatus,
            "tableOfContents": linkedTableOfContents
        }
    }
}

function getLegislationMetaData() {
    /*
    extract meta data about the given 
    legislation for subsequent display
    */
    const legisFront = document.querySelector("div#colLegis div#legisContent div.front")
    if (legisFront){
        legislationName = legisFront.querySelector("table tbody tr td.actHd")?.innerText.trim();
        legislationDescription = legisFront.querySelector("table tbody tr td.longTitle")?.innerText.trim();
        legislationDate = legisFront.querySelector("table tbody tr td.cDate")?.innerText.trim();
        revisedLegislationName = legisFront.querySelector("table tbody tr td.revdHdr")?.innerText.trim();
        revisedLegislationText = legisFront.querySelector("table tbody tr td.revdTxt")?.innerText.trim();
    } else {
        legislationName = "";
        legislationDescription = "";
        legislationDate = "";
        revisedLegislationName = "";
        revisedLegislationText = "";
    }
    return {
        "legislationName": legislationName,
        "legislationDescription": legislationDescription,
        "legislationDate": legislationDate,
        "revisedLegislationName": revisedLegislationName,
        "revisedLegislationText": revisedLegislationText
    }
}

function getLegislationDefinitions() {
    /*
    extracts definitions from within
    legislation and places it within 
    a json object for later retrieval
    */
    const definitions = []; 
    const regex = /“([^”]+)”/g;
    const provisionContainers = document.querySelectorAll("#colLegis #legisContent div.body div[class^='prov']");
    provisionContainers.forEach(container => {
        const rows = container.querySelectorAll("table tbody tr");
        rows.forEach(row => {
            const definitionCell = row.querySelector("td.def");
            if (definitionCell) {
                const sentence = definitionCell.innerText.trim();
                let match;
                if ((match = regex.exec(sentence)) !== null) {
                    const term = match[1].trim(); 
                    definitions.push({ [term]: sentence }); 
                }
            }
        });
    });
    return definitions;
}

function getLegislationContent() {
    /*
    extract main bulk of the content from the 
    legislation document

    FUA
    !!! continue debugging this function to work for 
    all sections and their defintions since this halts 
    at part 3 currently and write further code to 
    figure out why its not working

    trying this code out on other statutes like the penal 
    code similarly stops extracting data at chapter 3, is this
    an intentional pattern? this is the same for the torts limitation 
    act as well
    */

    const content = [] 
    const provisionContainers = document.querySelectorAll("#colLegis #legisContent div.body div[class^='prov']");

    console.log(provisionContainers)

    provisionContainers.forEach(container => {

        const rows = container.querySelectorAll("table tbody tr");

        rows.forEach(row => {

            // console.log(row.innerText.trim())

            const sectionHeader = row.querySelector("td[class^='prov'][class$='Hdr']")
            if (sectionHeader) {
                const sectionHeaderText = sectionHeader.innerText.trim()
                const sectionHeaderID = sectionHeader.id.trim()
                console.log(sectionHeaderID, sectionHeaderText)
                content.push(
                    {
                        "type": "sectionHeader",
                        "ID": sectionHeaderID,
                        "content": sectionHeaderText
                    }
                )
            } else {}

            const sectionBody = row.querySelector("td[class^='prov'][class$='Txt']")
            if (sectionBody) {
                const sectionBodyText = sectionBody.innerText.trim()
                console.log(sectionBodyText)
                content.push(
                    {
                        "type": "sectionBody",
                        "ID": null,
                        "content": sectionBodyText
                    }
                )
            } else {}

            const provisionHeader = row.querySelector("td.partHdr")
            if (provisionHeader) {
                const provisionHeaderID = provisionHeader.id
                const provisionHeaderText = provisionHeader.innerText.trim()
                console.log(provisionHeaderID, provisionHeaderText)
                content.push(
                    {
                        "type": "provisionHeader",
                        "ID": provisionHeaderID,
                        "content": provisionHeaderText
                    }
                )
            } else {}

            const provisionNumber = row.querySelector("td.part")
            if (provisionNumber) {
                const provisionNumberID = provisionNumber.id
                const provisionNumberText = provisionNumber.querySelector("div.partNo").innerText.trim()
                console.log(provisionNumberID, provisionNumberText)
                content.push(
                    {
                        "type": "provisionNumber",
                        "ID": provisionNumberID,
                        "content": provisionNumberText
                    }
                )
            } else {}

        });
    });

    return content
}

// ~~~~~ CREATE ELEMENTS ~~~~~

function createGenericButton() {
    /*
    creates and appends a html button 
    component that then prints an alert 
    to the screen when clicked
    */
    const button = document.createElement("button");
    button.innerText = "poke me 🫵";
    button.style.position = "fixed"; 
    button.style.top = "10px";
    button.style.right = "10px";
    button.style.zIndex = "1000"; 
    button.style.padding = "10px"; 
    button.style.backgroundColor = "#4CAF50"; 
    button.style.color = "white"; 
    button.style.border = "none"; 
    button.style.borderRadius = "5px"; 
    button.style.cursor = "pointer"; 
    button.addEventListener("click", () => {
        alert("Ouch! 🤕");
    });
    document.body.appendChild(button);
    return None
}


// ~~~ internal reference ~~~

//     div#nav.affix-top div#topLeftPanel.top-left-panel 
//         div.legis-title --> inner_text() to get full title of legislation
//         span.fa.fa-file-pdf-o --> try href() to get the link to the pdf document, if there's anyway to click this element or extract the link from within it to get the link to the PDF document of each peice of legislation
//         div.status-value --> inner_text() to get current version of the statute
//     div#tocPanel.toc-panel
//         nav#toc --> note a bunch of other classes are appended here but im ignoring them for the sake of simplicity
//             a.nav-link --> query_selector_all() these instances to see individual elements of the contents pageA
//                 b.active --> if inside, likely the header so extract inner_text(), extract the href()
//                  otherwise --> extract the href() and inner_text() to get to the exact header within the code
// div#colLegis div#legisContent
    // div.front 
        // table tbody tr.actHd --> inner_text() is the act header, find this if present
        // table tbody tr.revdHdr --> inner_text() is the revised act header, find this if present
        // table tbody tr.revdTxt --> inner_text() is the revised text, find this if present
        // table tbody tr.longTitle --> inner_text() is the long title that describes what the act is used for, find this if present
        // table tbbody tr.cDate --> inner_text() is the origial date the statute was first introduced
    // div.body
        // div.prov* --> query_selector_all(), where the * is a wildcard operator
            // table tbody tr --> query_selector_all(), then sort according to the below
                // td.prov*Hdr --> where the * is a wildcard operator --> inner_text() is generally the section header, get_attribute('id') if present also to save as required
                // td.prov*Txt --> where the * is a wilrdcard operator --> inner_text() is the section body which genearlly contains the longer explanation
                // td.prov*part --> get_attribute('id') if present also to save as required
                    // div.partNo --> inner_text() is generally the provision number
                // td.partHdr --> get_attribute('id') if present also to save as required, inner_text() is generally the provision header
                // td.def --> inner_text() is a specified definition and should be appended to a special array that will later be referenced

// ~ specific things to scrape and reformat ~

// ~ other to dos ~

// * consider adding a general link to FAQs per here --> https://sso.agc.gov.sg/Help/FAQ

// ~~~~~ EXECUTION CODE ~~~~~

alert("skill hunter launching...");
// console.log(deserialiseJSON(getPageBasicData()));
// console.log(deserialiseJSON(getLegislationMetaData()));
// console.log(deserialiseJSON(getLegislationDefinitions()));
console.log(deserialiseJSON(getLegislationContent()));