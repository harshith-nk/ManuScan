import os

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import base64
from io import BytesIO

import numpy as np
import torch

torch.set_num_threads(1)
torch.set_num_interop_threads(1)

from PIL import Image
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="ManuScan API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "manuscan_unet_scripted.pt"
)

FRONTEND_PATH = os.path.join(
    BASE_DIR,
    "frontend"
)

DEVICE = torch.device("cpu")

model = torch.jit.load(
    MODEL_PATH,
    map_location=DEVICE
)

model.eval()


def preprocess_image(image):
    image = image.resize(
        (512, 512),
        Image.Resampling.BILINEAR
    )

    image_array = np.array(
        image
    ).astype(np.float32) / 255.0

    mean = np.array(
        [0.485, 0.456, 0.406],
        dtype=np.float32
    )

    std = np.array(
        [0.229, 0.224, 0.225],
        dtype=np.float32
    )

    image_array = (
        image_array - mean
    ) / std

    image_tensor = torch.from_numpy(
        image_array.transpose(2, 0, 1)
    ).unsqueeze(0)

    return image_tensor


THRESHOLD = 0.20


@app.get("/api")
def api_status():
    return {
        "message": "ManuScan API is running",
        "status": "ready"
    }


@app.get("/")
def serve_frontend():
    return FileResponse(
        os.path.join(
            FRONTEND_PATH,
            "index.html"
        )
    )


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...)
):

    contents = await file.read()

    original = Image.open(
        BytesIO(contents)
    ).convert("RGB")

    original_size = original.size

    input_tensor = preprocess_image(
        original
    ).to(DEVICE)

    with torch.no_grad():

        output = model(
            input_tensor
        )

        probability = torch.sigmoid(
            output
        )

        prediction = (
            probability > THRESHOLD
        ).float()

    mask = (
        prediction
        .squeeze()
        .cpu()
        .numpy()
    )

    damaged_pixels = np.sum(
        mask == 1
    )

    total_pixels = mask.size

    damage_percentage = (
        damaged_pixels /
        total_pixels
    ) * 100

    mask_image = Image.fromarray(
        (mask * 255).astype(
            np.uint8
        )
    ).resize(
        original_size,
        Image.Resampling.NEAREST
    )

    original_array = np.array(
        original
    )

    mask_array = (
        np.array(mask_image) > 0
    )

    overlay = original_array.copy()

    overlay[mask_array] = [
        255,
        0,
        0
    ]

    overlay_image = Image.fromarray(
        overlay
    )

    buffer = BytesIO()

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
            float(damage_percentage),
            2
        ),
        "original_width": original_size[0],
        "original_height": original_size[1],
        "overlay": overlay_base64
    }


app.mount(
    "/",
    StaticFiles(
        directory=FRONTEND_PATH
    ),
    name="frontend"
)