function detectCurrentEditor() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("Success: Active document is Google Sheets: " + spreadsheet.getName());
    return;
  } catch (e) {
    Logger.log("Error: Active document is not Google Sheets.");
  }
  try {
    var document = DocumentApp.getActiveDocument();
    Logger.log("Success: Active document is Google Docs: " + document.getName());
    return;
  } catch (e) {
    Logger.log("Error: Active document is not Google Docs.");
  }
  try {
    var presentation = SlidesApp.getActivePresentation();
    Logger.log("Success: Active document is Google Slides: " + presentation.getName());
    return;
  } catch (e) {
    Logger.log("Error: Active document is not Google Slides.");
  }
  Logger.log("Error: No active Google editor found.");
}