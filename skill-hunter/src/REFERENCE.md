# `REFERENCE.md`

Generated while creating `Skill Hunter`.

### Navigation and Extraction

- **Div Structure**:
    - `div#nav.affix-top div#topLeftPanel.top-left-panel`
        - `div.legis-title` 
            - Use `inner_text()` to get the full title of legislation
        - `span.fa.fa-file-pdf-o` 
            - Try `href()` to get the link to the PDF document. Check if there’s a way to click this element or extract the link from within it.
        - `div.status-value`
            - Use `inner_text()` to get the current version of the statute

### Table of Contents Panel

- **Div Structure**:
    - `div#tocPanel.toc-panel`
        - `nav#toc`
            - Note that a bunch of other classes are appended here but ignore them for simplicity.
                - `a.nav-link`
                    - Check for `b.active`: if inside, likely the header, extract `inner_text()` and `href()`
                    - Otherwise: extract `href()` and `inner_text()` to get to the exact header within the code

### Legislation Content

- **Div Structure**:
    - `div#colLegis div#legisContent`
        - `div.front`
            - `table tbody tr.actHd`
                - Use `inner_text()` for the act header (if present)
            - `table tbody tr.revdHdr`
                - Use `inner_text()` for the revised act header (if present)
            - `table tbody tr.revdTxt`
                - Use `inner_text()` for the revised text (if present)
            - `table tbody tr.longTitle`
                - Use `inner_text()` for the long title that describes the act (if present)
            - `table tbody tr.cDate`
                - Use `inner_text()` for the original date the statute was first introduced

### Body Section

- **Div Structure**:
    - `div.body`
        - `div.prov*` (where `*` is a wildcard operator)
            - `table tbody tr`
                - Query all instances, then sort according to the below:
                    - `td.prov*Hdr` (wildcard operator)
                        - Use `inner_text()` for the section header. Get `get_attribute('id')` if present to save as required.
                    - `td.prov*Txt` (wildcard operator)
                        - Use `inner_text()` for the section body, which generally contains the longer explanation.
                    - `td.prov*part`
                        - Get `get_attribute('id')` if present to save as required.
                        - `div.partNo`
                            - Use `inner_text()` for the provision number.
                    - `td.partHdr`
                        - Get `get_attribute('id')` if present to save as required. Use `inner_text()` for the provision header.
                    - `td.def`
                        - Use `inner_text()` for a specified definition and append to a special array for later reference.