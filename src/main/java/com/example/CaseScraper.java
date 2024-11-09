package com.example;

import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitUntilState;
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

    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
            BrowserContext context = browser.newContext();
            Page page = context.newPage();
            page.navigate("URL_HERE", new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));

            CaseDetails caseDetails = new CaseDetails();
            
            // ----- EXTRACTING CASE TITLE -----
            Locator caseTitleEl = page.locator(".caseTitle");
            if (caseTitleEl.count() > 0) {
                caseDetails.caseTitle = caseTitleEl.textContent().trim();
            }

            // ----- EXTRACTING CASE SUMMARY DATA -----
            Locator infoTable = page.locator("#info-table");
            for (int i = 0; i < infoTable.locator("tr").count(); i++) {
                Locator rowCells = infoTable.locator("tr").nth(i).locator("td");
                if (rowCells.count() > 2) {
                    String cellText = rowCells.nth(2).textContent().trim();
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

            // ----- EXTRACTING CASE LEGAL ISSUES -----
            Locator legalIssues = page.locator("div.txt-body");
            if (legalIssues.count() > 0) {
                for (Locator issue : legalIssues.locator("*").all()) {
                    if (!issue.textContent().trim().isEmpty()) {
                        caseDetails.caseLegalIssues.add(issue.textContent().trim());
                    }
                }
            }

            // ----- EXTRACTING CASE BODY CONTENT ------
            Locator paragraphs = page.locator("p");
            String sectionName = "";
            List<String> buffer = new ArrayList<>();

            for (Locator paragraph : paragraphs.all()) {
                String paragraphText = paragraph.textContent().trim();
                String className = paragraph.evaluate("element => element.className");

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
                caseDetails.caseBody.put(sectionName, buffer);
            }

            // ----- FOR DEBUGGING -----
            System.out.println("Case Title: " + caseDetails.caseTitle);
            System.out.println("Case Number: " + caseDetails.caseNumber);
            System.out.println("Case Date: " + caseDetails.caseDate);
            System.out.println("Tribunal Court: " + caseDetails.caseTribunalCourt);
            System.out.println("Coram: " + caseDetails.caseCoram);
            System.out.println("Counsel: " + caseDetails.caseCounsel);
            System.out.println("Parties: " + caseDetails.caseParties);
            System.out.println("Legal Issues: " + String.join(", ", caseDetails.caseLegalIssues));
            System.out.println("Case Body:");
            caseDetails.caseBody.forEach((sec, content) -> {
                System.out.println("Section: " + sec);
                content.forEach(paragraph -> System.out.println(paragraph));
            });
        }
    }
}
