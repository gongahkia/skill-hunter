/*
FUA 
    * rewrite existing functionality from the groundup, of defining certain words within statutes inline 
    * add additional URL links so those words can be clicked to be brought to the definition section
    * edit manifest.json further later
    * learn how background workers in manifest v3 work and consider integrating a background script as necessary
    * add an outline / minimap of each section and subsection at the side of the webpage that has clickable links so users can easily navigate statutes
    * integrate further functionality such as 
        * statutes referenced within other statutes can be linked and their respective URLs will be clickable as well
        * mention of a given limb or section dependent on other sections will also be clickable, can be brought to that dependent section immediately
        * allow statutes and their composite sections and subsections to fold accordingly
    * rewrite the frontend to be pretty and minimal with nice smooth animations 
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
    * draw my own logo for skill-hunter v2 on my ipad based on my purple and green character wearing chrollo lucifer's clothes and carrying an inspired book maybe? then place within the local_asset folder and add to the overall README.md
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

// FUA continue working on this from here

// ~ general things to scrape and reformat ~

//     div#nav.affix-top div#topLeftPanel.top-left-panel 
//         div.legis-title --> inner_text() to get full title of legislation
//         span.fa.fa-file-pdf-o --> try href() to get the link to the pdf document, if there's anyway to click this element or extract the link from within it to get the link to the PDF document of each peice of legislation
//         div.status-value --> inner_text() to get current version of the statute

//     div#tocPanel.toc-panel
//         nav#toc --> note a bunch of other classes are appended here but im ignoring them for the sake of simplicity
//             a.nav-link --> query_selector_all() these instances to see individual elements of the contents pageA
//                 b.active --> if inside, likely the header so extract inner_text()

// ~ specific things to scrape and reformat ~

// ~ other to dos ~

// * consider adding a general link to FAQs per here --> https://sso.agc.gov.sg/Help/FAQ

// ~~~~~ EXECUTION CODE ~~~~~

alert("skill hunter launching...")