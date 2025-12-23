package com.example;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitUntilState;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.*;

public class CaseScraper {
    static class CaseDetails {
        String caseTitle = "";
        String caseNumber = "";
        String caseDate = "";
        String caseTribunalCourt = "";
        String caseCoram = "";
        String caseCounsel = "";
        String caseParties = "";
        List<String> caseLegalIssues = new ArrayList<>();
        Map<String, List<String>> caseBody = new LinkedHashMap<>();
    }

    private static String htmlEscape(String input) {
        if (input == null) return "";
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private static String sanitiseParagraph(String input) {
        if (input == null) return "";
        return input.replaceFirst("^\\s*\\d+\\s*", "").trim();
    }

    private static String buildToggleableHtml(CaseDetails details, String originalHtmlBase64) {
        String styleContent = "\n" +
                "    body {\n" +
                "        font-family: 'Arial', sans-serif;\n" +
                "        background-color: #f8f8f8;\n" +
                "        color: #333;\n" +
                "        margin: 0;\n" +
                "        padding: 0;\n" +
                "    }\n\n" +
                "    header {\n" +
                "        background-color: #333;\n" +
                "        color: #fff;\n" +
                "        text-align: center;\n" +
                "        padding: 1em;\n" +
                "        position: sticky;\n" +
                "        top: 0;\n" +
                "        z-index: 10;\n" +
                "    }\n\n" +
                "    #toggleButton {\n" +
                "        background-color: #4CAF50;\n" +
                "        color: white;\n" +
                "        cursor: pointer;\n" +
                "        border: none;\n" +
                "        border-radius: 5px;\n" +
                "        padding: 0.5em 0.8em;\n" +
                "        margin-left: 1em;\n" +
                "    }\n\n" +
                "    #toggleButton:hover {\n" +
                "        background-color: #316935;\n" +
                "    }\n\n" +
                "    main {\n" +
                "        max-width: 800px;\n" +
                "        margin: 2em auto;\n" +
                "        padding: 1em;\n" +
                "        background-color: #fff;\n" +
                "        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);\n" +
                "    }\n\n" +
                "    .line {\n" +
                "        margin-bottom: 1em;\n" +
                "        border-bottom: 1px solid #ccc;\n" +
                "        padding-bottom: 0.5em;\n" +
                "    }\n\n" +
                "    details {\n" +
                "        margin-bottom: 1em;\n" +
                "    }\n\n" +
                "    summary {\n" +
                "        cursor: pointer;\n" +
                "        font-weight: bold;\n" +
                "        border-bottom: 1px solid #ccc;\n" +
                "        padding-bottom: 0.5em;\n" +
                "        margin-bottom: 0.5em;\n" +
                "        outline: none;\n" +
                "    }\n\n" +
                "    details > p {\n" +
                "        margin-top: 0;\n" +
                "    }\n\n" +
                "    .github-credit {\n" +
                "        position: fixed;\n" +
                "        bottom: 10px;\n" +
                "        right: 10px;\n" +
                "        font-size: 12px;\n" +
                "        color: #555;\n" +
                "    }\n\n" +
                "    #originalFrame {\n" +
                "        width: 100%;\n" +
                "        height: calc(100vh - 80px);\n" +
                "        border: 0;\n" +
                "    }\n";

        StringBuilder issues = new StringBuilder();
        for (String issue : details.caseLegalIssues) {
            issues.append("<li>").append(htmlEscape(issue)).append("</li>");
        }

        StringBuilder bodySections = new StringBuilder();
        int secNum = 0;
        for (Map.Entry<String, List<String>> entry : details.caseBody.entrySet()) {
            String sectionTitle = htmlEscape(entry.getKey());
            StringBuilder paragraphsHtml = new StringBuilder();
            for (String paragraph : entry.getValue()) {
                secNum += 1;
                String cleaned = htmlEscape(sanitiseParagraph(paragraph));
                paragraphsHtml.append("<p>")
                        .append(secNum)
                        .append(".&emsp;")
                        .append(cleaned)
                        .append("</p>");
            }
            bodySections.append("<details><summary>")
                    .append(sectionTitle)
                    .append("</summary><p>")
                    .append(paragraphsHtml)
                    .append("</p></details>");
        }

        return "<!doctype html>\n" +
                "<html>\n" +
                "<head>\n" +
                "  <meta charset=\"utf-8\">\n" +
                "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
                "  <title>Judgeman</title>\n" +
                "  <style>" + styleContent + "</style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <header>\n" +
                "    <span id=\"dynamic-header\">" + htmlEscape(details.caseTitle) + "</span>\n" +
                "    <button id=\"toggleButton\">Toggle Page</button>\n" +
                "  </header>\n" +
                "\n" +
                "  <div id=\"simplifiedContainer\">\n" +
                "    <main id=\"dynamic-body\">\n" +
                "      <div class=\"line\"><b>Case number:</b> " + htmlEscape(details.caseNumber) + "</div>\n" +
                "      <div class=\"line\"><b>Date: </b> " + htmlEscape(details.caseDate) + "</div>\n" +
                "      <div class=\"line\"><b>Tribunal / Court: </b> " + htmlEscape(details.caseTribunalCourt) + "</div>\n" +
                "      <div class=\"line\"><b>Coram: </b> " + htmlEscape(details.caseCoram) + "</div>\n" +
                "      <div class=\"line\"><b>Counsel: </b> " + htmlEscape(details.caseCounsel) + "</div>\n" +
                "      <div class=\"line\"><b>Parties: </b> " + htmlEscape(details.caseParties) + "</div>\n" +
                "      <div class=\"line\"><b>Legal issues: </b><ul>" + issues + "</ul></div>\n" +
                "\n" +
                "      " + bodySections + "\n" +
                "    </main>\n" +
                "\n" +
                "    <div class=\"github-credit\">\n" +
                "      Designed and built by <a href=\"https://gongahkia.github.io/\">Gabriel Ong</a> | <a href=\"https://github.com/gongahkia/judgeman\">Source</a>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "\n" +
                "  <div id=\"originalContainer\" style=\"display:none\">\n" +
                "    <iframe id=\"originalFrame\" sandbox=\"allow-forms allow-modals allow-popups allow-same-origin allow-scripts\"></iframe>\n" +
                "  </div>\n" +
                "\n" +
                "  <script>\n" +
                "    const originalHtmlBase64 = '" + originalHtmlBase64 + "';\n" +
                "    const bytes = Uint8Array.from(atob(originalHtmlBase64), c => c.charCodeAt(0));\n" +
                "    const originalHtml = new TextDecoder('utf-8').decode(bytes);\n" +
                "    const originalFrame = document.getElementById('originalFrame');\n" +
                "    originalFrame.srcdoc = originalHtml;\n" +
                "\n" +
                "    let simplified = true;\n" +
                "    document.getElementById('toggleButton').addEventListener('click', () => {\n" +
                "      simplified = !simplified;\n" +
                "      document.getElementById('simplifiedContainer').style.display = simplified ? '' : 'none';\n" +
                "      document.getElementById('originalContainer').style.display = simplified ? 'none' : '';\n" +
                "    });\n" +
                "  </script>\n" +
                "</body>\n" +
                "</html>\n";
    }

    public static void main(String[] args) {
        String targetUrl = (args != null && args.length >= 1 && args[0] != null && !args[0].isBlank())
                ? args[0].trim()
                : "https://www.elitigation.sg/gd/s/2009_SGCA_3";

        String outputPath = (args != null && args.length >= 2 && args[1] != null && !args[1].isBlank())
                ? args[1].trim()
                : "judgeman_v2.html";

        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
            BrowserContext context = browser.newContext();
            Page page = context.newPage();
            page.navigate(targetUrl, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));

            String originalHtml = page.content();
            String originalHtmlBase64 = Base64.getEncoder().encodeToString(originalHtml.getBytes(StandardCharsets.UTF_8));

            CaseDetails caseDetails = new CaseDetails();
            
            // ----- EXTRACTING CASE TITLE -----
            Locator caseTitleEl = page.locator(".caseTitle");
            if (caseTitleEl.count() > 0) {
                caseDetails.caseTitle = caseTitleEl.textContent().trim();
            }

            // ----- EXTRACTING CASE SUMMARY DATA -----
            Locator infoTable = page.locator("#info-table");
            if (infoTable.count() > 0) {
                int rowCount = infoTable.locator("tr").count();
                for (int i = 0; i < rowCount; i++) {
                    Locator rowCells = infoTable.locator("tr").nth(i).locator("td");
                    if (rowCells.count() > 2) {
                        String cellText = Optional.ofNullable(rowCells.nth(2).textContent()).orElse("").trim();
                        switch (i) {
                            case 0 -> caseDetails.caseNumber = cellText;
                            case 1 -> caseDetails.caseDate = cellText;
                            case 2 -> caseDetails.caseTribunalCourt = cellText;
                            case 3 -> caseDetails.caseCoram = cellText;
                            case 4 -> caseDetails.caseCounsel = cellText;
                            case 5 -> caseDetails.caseParties = cellText;
                        }
                    }
                }
            }

            // ----- EXTRACTING CASE LEGAL ISSUES -----
            Locator legalIssues = page.locator("div.txt-body");
            if (legalIssues.count() > 0) {
                for (Locator issue : legalIssues.locator("xpath=./*").all()) {
                    String text = Optional.ofNullable(issue.textContent()).orElse("").trim();
                    if (!text.isEmpty()) {
                        caseDetails.caseLegalIssues.add(text);
                    }
                }
            }

            // ----- EXTRACTING CASE BODY CONTENT ------
            Locator paragraphs = page.locator("p");
            String sectionName = "";
            List<String> buffer = new ArrayList<>();

            for (Locator paragraph : paragraphs.all()) {
                String paragraphText = Optional.ofNullable(paragraph.textContent()).orElse("").trim();
                String className = Optional.ofNullable((String) paragraph.evaluate("element => element.className")).orElse("");

                if (className.contains("Judg-Heading-1")) {
                    if (!sectionName.isEmpty()) {
                        caseDetails.caseBody.put(sectionName, new ArrayList<>(buffer));
                        buffer.clear();
                    }
                    sectionName = paragraphText;
                } else if (className.contains("Judg-1") && paragraphText.matches("^\\d.*")) {
                    buffer.add(paragraphText);
                }
            }
            if (!sectionName.isEmpty()) {
                caseDetails.caseBody.put(sectionName, new ArrayList<>(buffer));
            }

            String outHtml = buildToggleableHtml(caseDetails, originalHtmlBase64);
            try {
                Files.writeString(Path.of(outputPath), outHtml, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new RuntimeException("Failed to write output HTML to: " + outputPath, e);
            }

            System.out.println("Wrote toggleable output to: " + outputPath);
        }
    }
}
