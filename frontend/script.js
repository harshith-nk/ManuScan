
const fileInput = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("status");
const results = document.getElementById("results");

const selectedFile = document.getElementById("selectedFile");
const dropZone = document.querySelector(".drop-zone");

const damagePercentage = document.getElementById("damagePercentage");
const originalImage = document.getElementById("originalImage");
const overlayImage = document.getElementById("overlayImage");

fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];

    if (!file) return;

    if (selectedFile) {
        selectedFile.textContent = file.name;
        selectedFile.classList.remove("hidden");
    }

    if (dropZone) {
        dropZone.classList.add("file-selected");

        dropZone.innerHTML = `
            <div class="selected-preview">
                <img
                    id="uploadPreview"
                    class="upload-preview"
                    alt="Selected manuscript preview"
                >
            </div>

            <div class="upload-selected-title">
                Manuscript selected
            </div>

            <div class="upload-selected-name">
                ${file.name}
            </div>

            <div class="upload-selected-hint">
                Click here to choose a different image
            </div>
        `;

        dropZone.onclick = () => fileInput.click();
    }

    const preview = document.getElementById("uploadPreview");

    if (preview) {
        preview.src = URL.createObjectURL(file);
    }

    if (results) {
        results.classList.add("hidden");
    }

    statusText.textContent = "Image selected. Ready for analysis.";
    statusText.classList.remove("error");

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Manuscript";
});


analyzeBtn.addEventListener("click", async () => {

    const file = fileInput.files[0];

    if (!file) {
        statusText.textContent = "Please select a manuscript image.";
        statusText.classList.add("error");
        return;
    }

    analyzeBtn.disabled = true;

    analyzeBtn.innerHTML = `
        <span class="loading-spinner"></span>
        Analyzing...
    `;

    statusText.textContent =
        "Analyzing manuscript damage. Please wait...";

    statusText.classList.remove("error");

    const formData = new FormData();
    formData.append("file", file);

    try {

        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("API request failed: " + response.status);
        }

        const data = await response.json();

        damagePercentage.textContent =
            data.damage_percentage + "%";

        originalImage.src =
            URL.createObjectURL(file);

        overlayImage.src =
            "data:image/jpeg;base64," + data.overlay;

        results.classList.remove("hidden");

        statusText.textContent =
            "Analysis completed successfully.";

        analyzeBtn.disabled = false;
        analyzeBtn.textContent =
            "Analyze Another Manuscript";

        setTimeout(() => {
            results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 150);

    } catch (error) {

        console.error(error);

        statusText.textContent =
            "Unable to analyze the manuscript. Please try again.";

        statusText.classList.add("error");

        analyzeBtn.disabled = false;
        analyzeBtn.textContent =
            "Try Analysis Again";
    }
});
