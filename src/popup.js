const modalOverlay = document.getElementById("modalOverlay");
const cancelButton = document.getElementById("cancelButton");
const simplifyButton = document.getElementById("simplifyButton");

cancelButton.addEventListener("click", () => {
    window.close()
    console.log("Cancel button clicked!");
});

simplifyButton.addEventListener("click", () => {
    window.close()
    console.log("Simplify button clicked!");
    /*
    FUA 
    add additional code from main.js that 
    triggers here later when the simplify button is pressed
    */
});

// function hideModal() {
//     modalOverlay.style.visibility = "hidden";
// }

// // hide the modal when clicking outside of the overlay 
// modalOverlay.addEventListener("click", (event) => {
//     if (event.target === modalOverlay) {
//         hideModal(); 
//     }
// });