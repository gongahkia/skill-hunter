use base64::{engine::general_purpose, Engine as _};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use std::error::Error;
use std::fs;

#[derive(Debug, Default)]
struct CaseDetails {
    case_title: String,
    case_number: String,
    case_date: String,
    case_tribunal_court: String,
    case_coram: String,
    case_counsel: String,
    case_parties: String,
    case_legal_issues: Vec<String>,
    // Preserve insertion order like v1 by keeping sections in a Vec
    case_body: Vec<(String, Vec<String>)>,
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn section_number_check(text: &str) -> bool {
    text.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
}

fn sanitise_paragraph(input: &str) -> String {
    let trimmed = input.trim_start();
    let mut idx = 0;
    for ch in trimmed.chars() {
        if ch.is_ascii_digit() {
            idx += ch.len_utf8();
        } else {
            break;
        }
    }
    trimmed[idx..].trim_start().to_string()
}

fn element_has_class(element: &scraper::ElementRef<'_>, class_name: &str) -> bool {
    let classes = element.value().attr("class").unwrap_or("");
    classes.split_whitespace().any(|c| c == class_name)
}

fn extract_case_info(document: &str) -> CaseDetails {
    let parsed = Html::parse_document(document);
    let mut details = CaseDetails::default();

    // ----- EXTRACT CASE TITLE -----
    if let Ok(sel) = Selector::parse(".caseTitle") {
        if let Some(title) = parsed.select(&sel).next() {
            details.case_title = title.text().collect::<Vec<_>>().join("").trim().to_string();
        }
    }

    // ----- EXTRACT CASE SUMMARY DATA -----
    let info_table_selector = Selector::parse("#info-table").ok();
    let tr_selector = Selector::parse("tr").ok();
    let td_selector = Selector::parse("td").ok();
    if let (Some(info_sel), Some(tr_sel), Some(td_sel)) = (info_table_selector, tr_selector, td_selector) {
        if let Some(table) = parsed.select(&info_sel).next() {
            for (i, row) in table.select(&tr_sel).enumerate() {
                let cells: Vec<_> = row.select(&td_sel).collect();
                if cells.len() > 2 {
                    let cell_text = cells[2].text().collect::<Vec<_>>().join("").trim().to_string();
                    match i {
                        0 => details.case_number = cell_text,
                        1 => details.case_date = cell_text,
                        2 => details.case_tribunal_court = cell_text,
                        3 => details.case_coram = cell_text,
                        4 => details.case_counsel = cell_text,
                        5 => details.case_parties = cell_text,
                        _ => {}
                    }
                }
            }
        }
    }

    // ----- EXTRACT CASE LEGAL ISSUES (direct child elements) -----
    let legal_sel = Selector::parse("div.txt-body").ok();
    if let Some(legal_sel) = legal_sel {
        if let Some(legal) = parsed.select(&legal_sel).next() {
            let child_selector = Selector::parse(":scope > *").ok();
            if let Some(child_sel) = child_selector {
                for child in legal.select(&child_sel) {
                    let text = child.text().collect::<Vec<_>>().join("").trim().to_string();
                    if !text.is_empty() {
                        details.case_legal_issues.push(text);
                    }
                }
            } else {
                // Fallback: any element inside
                if let Ok(any_sel) = Selector::parse("*") {
                    for child in legal.select(&any_sel) {
                        let text = child.text().collect::<Vec<_>>().join("").trim().to_string();
                        if !text.is_empty() {
                            details.case_legal_issues.push(text);
                        }
                    }
                }
            }
        }
    }

    // ----- EXTRACT CASE BODY CONTENT -----
    let p_selector = Selector::parse("p").ok();
    if let Some(p_sel) = p_selector {
        let mut section_name = String::new();
        let mut buffer: Vec<String> = Vec::new();

        for paragraph in parsed.select(&p_sel) {
            let paragraph_text = paragraph.text().collect::<Vec<_>>().join("").trim().to_string();
            let is_heading = element_has_class(&paragraph, "Judg-Heading-1");
            let is_body = element_has_class(&paragraph, "Judg-1");

            if is_heading {
                if !section_name.is_empty() {
                    details.case_body.push((section_name.clone(), buffer.clone()));
                    buffer.clear();
                }
                section_name = paragraph_text;
            } else if is_body && section_number_check(paragraph_text.as_str()) {
                buffer.push(paragraph_text);
            }
        }

        if !section_name.is_empty() {
            details.case_body.push((section_name, buffer));
        }
    }

    details
}

fn build_toggleable_html(details: &CaseDetails, original_html_base64: &str) -> String {
    let mut issues = String::new();
    for issue in &details.case_legal_issues {
        issues.push_str("<li>");
        issues.push_str(&html_escape(issue));
        issues.push_str("</li>");
    }

    let mut body_sections = String::new();
    let mut sec_num: usize = 0;
    for (section_title, paragraphs) in &details.case_body {
        let mut paragraphs_html = String::new();
        for paragraph in paragraphs {
            sec_num += 1;
            let cleaned = html_escape(&sanitise_paragraph(paragraph));
            paragraphs_html.push_str(&format!("<p>{}.&emsp;{}</p>", sec_num, cleaned));
        }

        body_sections.push_str("<details><summary>");
        body_sections.push_str(&html_escape(section_title));
        body_sections.push_str("</summary><p>");
        body_sections.push_str(&paragraphs_html);
        body_sections.push_str("</p></details>");
    }

    format!(
        r#"<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Judgeman</title>
  <style>
    body {{
        font-family: 'Arial', sans-serif;
        background-color: #f8f8f8;
        color: #333;
        margin: 0;
        padding: 0;
    }}

    header {{
        background-color: #333;
        color: #fff;
        text-align: center;
        padding: 1em;
        position: sticky;
        top: 0;
        z-index: 10;
    }}

    #toggleButton {{
      background-color: #4CAF50;
      color: white;
      cursor: pointer;
      border: none;
      border-radius: 5px;
      padding: 0.5em 0.8em;
      margin-left: 1em;
    }}

    #toggleButton:hover {{
      background-color: #316935;
    }}

    main {{
        max-width: 800px;
        margin: 2em auto;
        padding: 1em;
        background-color: #fff;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }}

    .line {{
        margin-bottom: 1em;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.5em;
    }}

    details {{
        margin-bottom: 1em;
    }}

    summary {{
        cursor: pointer;
        font-weight: bold;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.5em;
        margin-bottom: 0.5em;
        outline: none;
    }}

    details > p {{
        margin-top: 0;
    }}

    .github-credit {{
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 12px;
        color: #555;
    }}

    #originalFrame {{
        width: 100%;
        height: calc(100vh - 80px);
        border: 0;
    }}
  </style>
</head>
<body>
  <header>
    <span id="dynamic-header">{case_title}</span>
    <button id="toggleButton">Toggle Page</button>
  </header>

  <div id="simplifiedContainer">
    <main id="dynamic-body">
      <div class="line"><b>Case number:</b> {case_number}</div>
      <div class="line"><b>Date: </b> {case_date}</div>
      <div class="line"><b>Tribunal / Court: </b> {case_tribunal}</div>
      <div class="line"><b>Coram: </b> {case_coram}</div>
      <div class="line"><b>Counsel: </b> {case_counsel}</div>
      <div class="line"><b>Parties: </b> {case_parties}</div>
      <div class="line"><b>Legal issues: </b><ul>{issues}</ul></div>

      {body_sections}
    </main>

    <div class="github-credit">
      Designed and built by <a href="https://gongahkia.github.io/">Gabriel Ong</a> | <a href="https://github.com/gongahkia/judgeman">Source</a>
    </div>
  </div>

  <div id="originalContainer" style="display:none">
    <iframe id="originalFrame" sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"></iframe>
  </div>

  <script>
    const originalHtmlBase64 = '{original_b64}';
    const bytes = Uint8Array.from(atob(originalHtmlBase64), c => c.charCodeAt(0));
    const originalHtml = new TextDecoder('utf-8').decode(bytes);
    const originalFrame = document.getElementById('originalFrame');
    originalFrame.srcdoc = originalHtml;

    let simplified = true;
    document.getElementById('toggleButton').addEventListener('click', () => {{
      simplified = !simplified;
      document.getElementById('simplifiedContainer').style.display = simplified ? '' : 'none';
      document.getElementById('originalContainer').style.display = simplified ? 'none' : '';
    }});
  </script>
</body>
</html>
"#,
        case_title = html_escape(&details.case_title),
        case_number = html_escape(&details.case_number),
        case_date = html_escape(&details.case_date),
        case_tribunal = html_escape(&details.case_tribunal_court),
        case_coram = html_escape(&details.case_coram),
        case_counsel = html_escape(&details.case_counsel),
        case_parties = html_escape(&details.case_parties),
        issues = issues,
        body_sections = body_sections,
        original_b64 = original_html_base64
    )
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let target_url = args
        .next()
        .unwrap_or_else(|| "https://www.elitigation.sg/gd/s/2009_SGCA_3".to_string());
    let output_path = args.next().unwrap_or_else(|| "judgeman_v3.html".to_string());

    let client = Client::builder().build()?;
    let response = client.get(&target_url).send()?;
    let original_html = response.text()?;

    let details = extract_case_info(&original_html);
    let original_b64 = general_purpose::STANDARD.encode(original_html.as_bytes());
    let out_html = build_toggleable_html(&details, &original_b64);

    fs::write(output_path.clone(), out_html)?;
    println!("Wrote toggleable output to: {}", output_path);
    Ok(())
}
