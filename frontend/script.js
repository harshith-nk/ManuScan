const fileInput = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("status");
const results = document.getElementById("results");

const selectedFile = document.getElementById("selectedFile");
const dropZone = document.querySelector(".drop-zone");

const damagePercentage = document.getElementById("damagePercentage");
const originalImage = document.getElementById("originalImage");
const overlayImage = document.getElementById("overlayImage");

let selectedOriginalFile = null;


// --------------------------------------------------
// Compress image before sending to Vercel
// --------------------------------------------------

async function prepareUpload(file) {

    const MAX_DIMENSION = 2048;
    const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;

    const bitmap = await createImageBitmap(file);

    let width = bitmap.width;
    let height = bitmap.height;

    const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(width, height)
    );

    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );

    bitmap.close();

    let quality = 0.85;
    let blob;

    do {

        blob = await new Promise(resolve => {
            canvas.toBlob(
                resolve,
                "image/jpeg",
                quality
            );
        });

        quality -= 0.05;

    } while (
        blob.size > TARGET_MAX_BYTES &&
        quality >= 0.50
    );

    if (!blob) {
        throw new Error("Unable to prepare image for upload.");
    }

    return new File(
        [blob],
        "manuscan_upload.jpg",
        {
            type: "image/jpeg"
        }
    );
}


// --------------------------------------------------
// File selection
// --------------------------------------------------

fileInput.addEventListener("change", () => {

    const file = fileInput.files[0];

    if (!file) return;

    selectedOriginalFile = file;

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

    statusText.textContent =
        "Image selected. Ready for analysis.";

    statusText.classList.remove("error");

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Manuscript";
});


// --------------------------------------------------
// Analyze manuscript
// --------------------------------------------------

analyzeBtn.addEventListener("click", async () => {

    const file = selectedOriginalFile || fileInput.files[0];

    if (!file) {

        statusText.textContent =
            "Please select a manuscript image.";

        statusText.classList.add("error");

        return;
    }

    analyzeBtn.disabled = true;

    analyzeBtn.innerHTML = `
        <span class="loading-spinner"></span>
        Analyzing...
    `;

    statusText.textContent =
        "Preparing manuscript image for analysis...";

    statusText.classList.remove("error");

    try {

        // Compress/resize only the copy sent to the backend
        const uploadFile = await prepareUpload(file);

        statusText.textContent =
            "Analyzing manuscript damage. Please wait...";

        const formData = new FormData();

        formData.append(
            "file",
            uploadFile
        );

        const response = await fetch("/analyze", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {

            throw new Error(
                "API request failed: " + response.status
            );
        }

        const data = await response.json();

        damagePercentage.textContent =
            data.damage_percentage + "%";

        // Keep showing the ORIGINAL image here
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