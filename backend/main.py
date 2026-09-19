import os
import io
import base64
import torch
import numpy as np

from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from torchvision import transforms
import segmentation_models_pytorch as smp

MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "best_manuscan_unet.pth"))
FRONTEND_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(
    title="ManuScan API",
    description="Manuscript damage detection and percentage estimation API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

image_transform = transforms.Compose([
    transforms.Resize(
        (512, 512),
        interpolation=transforms.InterpolationMode.BILINEAR
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

model = smp.Unet(
    encoder_name="resnet18",
    encoder_weights=None,
    in_channels=3,
    classes=1
)

model.load_state_dict(
    torch.load(MODEL_PATH, map_location=DEVICE)
)

model = model.to(DEVICE)
model.eval()


@app.get("/")
def root():
    return FileResponse(
        os.path.join(FRONTEND_PATH, "index.html")
    )


@app.get("/style.css")
def style():
    return FileResponse(
        os.path.join(FRONTEND_PATH, "style.css")
    )


@app.get("/script.js")
def script():
    return FileResponse(
        os.path.join(FRONTEND_PATH, "script.js")
    )


@app.get("/api")
def api_status():
    return {
        "message": "ManuScan API is running",
        "status": "ready"
    }


@app.post("/analyze")
async def analyze_manuscript(
    file: UploadFile = File(...)
):
    image_bytes = await file.read()

    original = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    original_size = original.size

    input_tensor = image_transform(
        original
    ).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        output = model(input_tensor)
        probability = torch.sigmoid(output)
        prediction = (probability > 0.20).float()

    mask = prediction.squeeze().cpu().numpy()

    damaged_pixels = np.sum(mask == 1)
    total_pixels = mask.size

    damage_percentage = (
        damaged_pixels / total_pixels
    ) * 100

    mask_image = Image.fromarray(
        (mask * 255).astype(np.uint8)
    ).resize(
        original_size,
        Image.Resampling.NEAREST
    )

    original_array = np.array(original)
    mask_array = np.array(mask_image) > 0

    overlay = original_array.copy()
    overlay[mask_array] = [255, 0, 0]

    overlay_image = Image.fromarray(overlay)

    buffer = io.BytesIO()

    overlay_image.save(
        buffer,
        format="JPEG",
        quality=90
    )

    overlay_base64 = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    return {
        "filename": file.filename,
        "damage_percentage": round(
            float(damage_percentage), 2
        ),
        "original_width": original_size[0],
        "original_height": original_size[1],
        "overlay": overlay_base64
    }
