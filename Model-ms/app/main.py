import sys
import os
import json
import tempfile
import requests
import traceback
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from lsc_engine import LSCEngine
from gtts import gTTS

app = FastAPI()

async def _process_video_file(file: UploadFile) -> str:
    """
    Helper function to process uploaded video and return predicted text.
    """
    video_path = None
    try:
        # Create temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp.close()
        video_path = tmp.name

        # Save uploaded content
        content = await file.read()
        print(f"[DEBUG] Processing file size: {len(content)} bytes")
        
        with open(video_path, "wb") as f:
            f.write(content)

        # Predict
        predictor = LSCEngine.get_predictor()
        if predictor is None:
            raise HTTPException(status_code=500, detail="Modelo no cargado")

        result = predictor.predict_video(video_path)

        if not result:
            raise HTTPException(status_code=422, detail="No se pudo reconocer ninguna seña")

        # "Letra_L" -> "L"
        return result.replace("Letra_", "")

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
    finally:
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except:
                pass

@app.post("/predict")
async def predict_video(request: Request, file: UploadFile = File(...)):
    print("\n[DEBUG] --- /predict Request ---")
    text = await _process_video_file(file)
    print(f"[DEBUG] Result: {text}")
    return {
        "success": True,
        "text": text
    }

@app.post("/predict/audio")
async def predict_audio(request: Request, file: UploadFile = File(...)):
    print("\n[DEBUG] --- /predict/audio Request ---")
    
    # 1. Get Text
    text = await _process_video_file(file)
    print(f"[DEBUG] Result for Audio: {text}")

    # 2. Generate Audio
    try:
        # Create temp file for audio
        # Note: We need to handle this file cleanup. FileResponse includes background tasks usually, 
        # but for simplicity we will rely on OS temp cleaning or overwrite risks manageable in single-user demo.
        # Ideally: BackgroundTask to delete.
        
        fd, audio_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        print(f"[DEBUG] Generating audio for: '{text}' at {audio_path}")
        tts = gTTS(text=text, lang='es')
        tts.save(audio_path)
        
        # Return file (media_type="audio/mpeg")
        # To delete after sending, we can use background task, but let's keep it simple first.
        return FileResponse(audio_path, media_type="audio/mpeg", filename="translation.mp3")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")
