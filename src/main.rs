extern crate reqwest;
extern crate scraper;

use scraper::{Html, Selector};
use std::collections::HashMap;

#[derive(Debug)]
struct Case {
    case_title: String,
    case_number: String,
    case_date: String,
    case_tribunal_court: String,
    case_coram: String,
    case_counsel: String,
    case_parties: String,
    case_legal_issues: Vec<String>,
    case_body: HashMap<String, Vec<String>>,
}

impl Case {
    fn new() -> Self {
        Case {
            case_title: String::new(),
            case_number: String::new(),
            case_date: String::new(),
            case_tribunal_court: String::new(),
            case_coram: String::new(),
            case_counsel: String::new(),
            case_parties: String::new(),
            case_legal_issues: Vec::new(),
            case_body: HashMap::new(),
        }
    }

    fn extract_case_info(&mut self, document: &str) {
        let fragment = Html::parse_document(document);
        
        // ~~~~~ EXTRACT CASE TITLE ~~~~~

        let case_title_selector = Selector::parse(".caseTitle").unwrap();
        if let Some(title) = fragment.select(&case_title_selector).next() {
            self.case_title = title.text().collect::<String>().trim().to_string();
        }

        // ~~~~~ EXTRACT CASE SUMMARY INFO ~~~~~

        let info_table_selector = Selector::parse("#info-table").unwrap();
        if let Some(table) = fragment.select(&info_table_selector).next() {
            for (i, row) in table.select(&Selector::parse("tr").unwrap()).enumerate() {
                let cells: Vec<_> = row.select(&Selector::parse("td").unwrap()).collect();
                if cells.len() > 2 {
                    match i {
                        0 => self.case_number = cells[2].text().collect::<String>().trim().to_string(),
                        1 => self.case_date = cells[2].text().collect::<String>().trim().to_string(),
                        2 => self.case_tribunal_court = cells[2].text().collect::<String>().trim().to_string(),
                        3 => self.case_coram = cells[2].text().collect::<String>().trim().to_string(),
                        4 => self.case_counsel = cells[2].text().collect::<String>().trim().to_string(),
                        5 => self.case_parties = cells[2].text().collect::<String>().trim().to_string(),
                        _ => {}
                    }
                }
            }
        }

        // ~~~~~ EXTRACT LEGAL ISSUES ~~~~~

        let legal_issues_selector = Selector::parse("div.txt-body").unwrap();
        if let Some(legal_issues) = fragment.select(&legal_issues_selector).next() {
            for child in legal_issues.children() {
                if let Some(text) = child.text().next() {
                    if !text.trim().is_empty() {
                        self.case_legal_issues.push(text.trim().to_string());
                    }
                }
            }
        }

        // ~~~~~ EXTRACT THE BODY CONTENT ~~~~~

        let mut section_name = String::new();
        let mut buffer = Vec::new();
        let paragraphs_selector = Selector::parse("p").unwrap();
        for paragraph in fragment.select(&paragraphs_selector) {
            if paragraph.has_class("Judg-Heading-1") {
                if !section_name.is_empty() {
                    self.case_body.insert(section_name.clone(), buffer.clone());
                }
                section_name = paragraph.text().collect::<String>().trim().to_string();
                buffer.clear();
            } else if paragraph.has_class("Judg-1") && section_number_check(&paragraph.text().collect::<String>()) {
                buffer.push(paragraph.text().collect::<String>().trim().to_string());
            }
        }
        if !section_name.is_empty() {
            self.case_body.insert(section_name, buffer);
        }
    }
    fn section_number_check(text: &str) -> bool {
        text.chars().next().map(|c| c.is_digit(10)).unwrap_or(false)
    }
}

fn main() {
    let document = "<html>...</html>"; 
    let mut case = Case::new();
    case.extract_case_info(document);
    println!("{:#?}", case);
}
