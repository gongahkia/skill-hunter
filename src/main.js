/*
FUA 
    * edit manifest.json further later
    * add further support to seperate and store part numbers and part headers in the created json
    * add additional URL links so those words can be clicked to be brought to the definition section
    * consider restricting how much the user is able to be shown at any given type
        * instead of seeing a whole statute the script will show specific sections at any given time
        * this also make it easier for the scraper to reformat and define things in line
        * if adopting this approach, edit the regex content_matching urls in manifest.json
    * add an outline / minimap of each section and subsection at the side of the webpage that has clickable links so users can easily navigate statutes, ask GPT for help with generating a dynamic minimap
    * integrate further functionality such as 
        * statutes referenced within other statutes can be linked and their respective URLs will be clickable as well
        * mention of a given limb or section dependent on other sections will also be clickable, can be brought to that dependent section immediately
        * allow statutes and their composite sections and subsections to fold accordingly
    * rewrite the frontend to be pretty and minimal with nice smooth animations 
        * use a lot of emojis to keep the UI design nice and modern
        * reference idea --> https://cdn.prod.website-files.com/62dabe5dc266a398da4d2629/62fcf2e4a604ce2bd71b7011_all-activities.png   
    * consider keeping the display discrete and include a minimal and complex view that expands out to show all hidden details, minimal view should avoid distracting the user as far as possible
    * consider adding a local notepad that users can use to save specific statutes or an AI integration that explains what a given statute means to users
    * allow user customisation via specification of additional configurations within a local .json file users can place in the same directory as the manifest.json
        * add serialising and deserialising functions to read this config.json
        * add documentation for what can be customised in the README.md
    * clean up the description, screenshots and installation instructions in the README.md
    * HARD DEADLINE 15 Nov to get skill_hunter up and running, email Jerrold Soh then to sell my app and harvest free classpart if possible
    * test to ensure the browser extension runs on all statutes including longer ones like the Penal Code
    * test out functionality of browser extension on the following browsers, then specify which browsers the extension is functional for in the README.md under browser support
        * google chrome
        * microsoft edge
        * brave
        * opera
        * mozilla firefox 
        * safari (come up with a browser-specific version for portability and runnability on macs if required)
    * learn how background workers in manifest v3 work and consider integrating a background script as necessary
    * consider handling installation of skill_hunter using docker or some other tools, ask GPT what other tooling alternatives there are for this
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

function formatLogicalConnecters(input_sentence) {
    /*
    formats any logical connectors within a 
    sentence by bolding and italicising them
    */
    const logicalConnectingWords = [
    "and", "also", "as well as", "in addition", "furthermore", "moreover",
    "but", "however", "on the other hand", "yet", "although", "nevertheless",
    "because", "since", "therefore", "thus", "as a result", "consequently",
    "similarly", "likewise", "in the same way", "first", "then", "next", 
    "finally", "afterward", "if", "unless", "provided that",
    "besides", "not only... but also", "along with", "as well",
    "despite", "in contrast", "on the contrary", "even though", "rather",
    "due to", "owing to", "for this reason", "accordingly",
    "in comparison", "just as", "equally", "correspondingly",
    "subsequently", "prior to", "simultaneously", "at the same time", "earlier",
    "in case", "assuming that", "even if", "as long as",
    "granted that", "admittedly", "regardless",
    "in summary", "to sum up", "in conclusion", "all in all", "ultimately",
    "for example", "for instance", "to illustrate", "in other words",
    "or", "nor", "either", "alternatively", "otherwise"
    ];
    const regexPattern = new RegExp(`\\b(${logicalConnectingWords.join('|')})\\b`, 'gi');
    return input_sentence.replace(regexPattern, (match) => `<b><i>${match}</i></b>`);
}

// ~~~~~ COSMETIC ~~~~~

function applyColorScheme(scheme) {
    /*
    applies the specified colorscheme to 
    the browser and returns the current 
    browser colorscheme
    */
    const root = document.documentElement;
    const schemes = {
        'dark': {
            '--bg-color': '#1e1e1e',
            '--text-color': '#ffffff',
        },
        'light': {
            '--bg-color': '#ffffff',
            '--text-color': '#000000',
        },
        'gruvbox': {
            '--bg-color': '#282828',
            '--text-color': '#ebdbb2',
        },
        'everforest': {
            '--bg-color': '#2b3339',
            '--text-color': '#d3c6aa',
        },
        'solarized-dark': {
            '--bg-color': '#002b36',
            '--text-color': '#839496',
        },
        'solarized-light': {
            '--bg-color': '#fdf6e3',
            '--text-color': '#657b83',
        },
        'dracula': {
            '--bg-color': '#282a36',
            '--text-color': '#f8f8f2',
        },
        'monokai': {
            '--bg-color': '#272822',
            '--text-color': '#f8f8f2',
        },
        'nord': {
            '--bg-color': '#2e3440',
            '--text-color': '#d8dee9',
        },
        'tokyo-night': {
            '--bg-color': '#1a1b26',
            '--text-color': '#c0caf5',
        }
    };
    const selectedScheme = schemes[scheme];
    if (selectedScheme) {
        root.style.setProperty('--bg-color', selectedScheme['--bg-color']);
        root.style.setProperty('--text-color', selectedScheme['--text-color']);
    } else {
        console.warn(`Color scheme "${scheme}" not found`);
    }
}

function applyFont(font) {
    /*
    applies the specified font to the 
    browser and returns the current
    browser font
    */
    const availableFonts = ['Arial', 'Times New Roman', 'Comic Sans MS', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Palatino', 'Garamond', 'Helvetica'];
    if (availableFonts.includes(font)) {
        document.body.style.fontFamily = font;
    } else {
        console.warn(`Font "${font}" not supported`);
    }
    return None
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

    !!!NOTE
    a possible fix for the incomplete scrolling is as follows

        upon first scraping the site, the url is as such --> https://sso.agc.gov.sg/Act/LA1959
        after getting the user to click whole document, the url is as such --> https://sso.agc.gov.sg/Act/LA1959?WholeDoc=1
        then, either
            1. find a way to access the last possible provision header within the tableOfContents array already scraped as part of pageBasicData, access the last element's URL
            2. get the user to manually click the last section OR
        after that, the url is as such --> https://sso.agc.gov.sg/Act/LA1959?WholeDoc=1#pr35-
        then initiate the running of the already existing scraping script and all the statutes should be succesfully extracted

    !!!ALSO

    add the following to the below in this function to scan within provTxt td or outside of it 
    where if there is 
    a td.fs then it is either a Illustration/Explanation
        if content of the td.fs is <em></em> tags with the innerText of "Illustrations" or "Illustration", then it is a illustrationHeader
            {
                "type": "illustrationHeader",
                "ID": illustrationHeaderID,
                "content": illustrationHeaderText
            }
        if content and the following chunk of text has no <em>Illustration</em> or <em>Illustrations</em>, then it is an illustrationBody
            {
                "type": "illustrationBody",
                "ID": illustrationBodyID,
                "content": illustrationBodyText
            }
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

function createTableOfContents(pageBasicData) {
    /*
    dynamically generates a clickable table 
    of contents based on the tableOfContents 
    scraped from the getPageBasicData() function

    FUA 
    edit and add implementation of this function here, 
    html code for the table of contents can be taken from 
    tableOfContents.html file in the same directory as this
    one
    */
    tableOfContentsString = ""
    tableOfContentsStyle = ```
    <style>
        .toc-container {
            width: 300px;
            background: white;
            border-radius: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .toc-header {
            background: #1a1b26;
            color: white;
            padding: 20px 24px;
            font-size: 18px;
            font-weight: 500;
            border-radius: 24px 24px 0 0;
            position: relative;
        }

        .toc-header::after {
            content: '';
            position: absolute;
            bottom: -24px;
            left: 0;
            right: 0;
            height: 24px;
            background: #1a1b26;
            border-radius: 0 0 24px 24px;
        }

        .toc-content {
            padding: 40px 24px 24px;
        }

        .toc-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .toc-item {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            margin-bottom: 8px;
            color: #1a1b26;
            font-size: 14px;
            border-radius: 12px;
            cursor: pointer;
            transition: background-color 0.2s, color 0.2s;
        }

        .toc-item::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #ff4b6e;
            border-radius: 50%;
            margin-right: 12px;
            flex-shrink: 0;
        }

        .toc-item.active {
            background: #ff4b6e;
            color: white;
        }

        .toc-item.active::before {
            background: white;
        }

        .toc-item:hover {
            background: #ff4b6e;
            color: white;
        }

        .toc-item:hover::before {
            background: white;
        }

        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #e9e4ff 0%, #f3e7ff 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
    </style>
    ```

tableOfContentsHeader = 
```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
```

tableOfContentsBody = 
```
</head>
<body>
    <div class="toc-container">
        <div class="toc-header">
            ${legislationTitle}
        </div>
        <div class="toc-content">
            <ul class="toc-list">
```

tableOfContentsFooter = 
```
            </ul>
        </div>
    </div>
</body>
</html>
```
    const legislationTitle = pageBasicData.legislationTitle
    const tableOfContentsArray = pageBasicData.tableOfContents
    console.log(tableofContentsArray)
    tableOfContentsArray.forEach(element => {
        tableOfContentsString += "<li a='${element.referenceUrl}' class='toc-item'>${element.referenceText}</li>\n"
    });
    return ```
${tableOfContentsHeader}
${tableOfContentsStyle}
${tableOfContentsBody}
${tableOfContentsString}
${tableOfContentsFooter}
    ```
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
const pageBasicData = getPageBasicData()
console.log(deserialiseJSON(pageBasicData));
console.log(createTableOfContents(pageBasicData))
// console.log(deserialiseJSON(getLegislationMetaData()));
// console.log(deserialiseJSON(getLegislationDefinitions()));
// console.log(deserialiseJSON(getLegislationContent()));
// applyColorScheme("gruvbox")