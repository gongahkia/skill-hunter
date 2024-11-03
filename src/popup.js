const modalOverlay = document.getElementById("modalOverlay");
const cancelButton = document.getElementById("cancelButton");
const simplifyButton = document.getElementById("simplifyButton");

function hideModal() {
    modalOverlay.style.visibility = "hidden";
}

cancelButton.addEventListener("click", () => {
    hideModal(); 
    console.log("Cancel button clicked!");
});

simplifyButton.addEventListener("click", () => {
    hideModal(); 
    console.log("Simplify button clicked!");
    /*
    FUA 
    add additional code from main.js that 
    triggers here later when the simplify button is pressed
    */
});

// // hide the modal when clicking outside of the overlay 
// modalOverlay.addEventListener("click", (event) => {
//     if (event.target === modalOverlay) {
//         hideModal(); 
//     }
// });