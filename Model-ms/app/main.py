import sys
import os
import json
import tempfile
import requests
import traceback
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel
from lsc_engine import LSCEngine, MODEL_PATH, CONFIG_PATH
from lsc_streaming_exacto import LSCStreamingPredictor
from gtts import gTTS # Fixed capitalization
import numpy as np

app = FastAPI()

# Configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def log(*args, **kwargs):
    if LOGS_ENABLED:
        print(*args, **kwargs)

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
        log(f"[DEBUG] Processing file size: {len(content)} bytes")
        
        with open(video_path, "wb") as f:
            f.write(content)

        # Predict
        predictor = LSCEngine.get_predictor()
        if predictor is None:
            raise HTTPException(status_code=500, detail="Modelo no cargado")

        result = predictor.predict_video(video_path)

        if not result:
            raise HTTPException(status_code=422, detail="No se pudo reconocer ninguna seña")

        # Return the label as-is (COL-NUM-WORD model includes letters, numbers, colors, words)
        return result

    except HTTPException:
        raise
    except Exception as e:
        if LOGS_ENABLED:
            traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
    finally:
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except:
                pass

class LandmarksRequest(BaseModel):
    data: list

@app.post("/predict")
async def predict_video(request: Request, file: UploadFile = File(...)):
    log("\n[DEBUG] --- /predict Request ---")
    text = await _process_video_file(file)
    log(f"[DEBUG] Result: {text}")
    return {
        "success": True,
        "text": text
    }

@app.post("/predict/landmarks")
async def predict_landmarks(body: LandmarksRequest):
    # body.data should be the list of 226 floats
    try:
        predictor = LSCEngine.get_predictor()
        if not predictor:
            raise HTTPException(status_code=500, detail="Modelo no cargado")
        
        # Aplicar la misma normalización que usa el evaluador
        coords = np.array(body.data, dtype=np.float32)
        result = predictor.predict_from_coords(coords.tolist())
        return result
    except Exception as e:
        if LOGS_ENABLED:
            traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/audio")
async def predict_audio(request: Request, file: UploadFile = File(...)):
    log("\n[DEBUG] --- /predict/audio Request ---")
    
    # 1. Get Text
    text = await _process_video_file(file)
    log(f"[DEBUG] Result for Audio: {text}")

    audio_path = None
    # 2. Generate Audio
    try:
        fd, audio_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        log(f"[DEBUG] Generating audio for: '{text}' at {audio_path}")
        tts = gTTS(text=text, lang='es')
        tts.save(audio_path)
        
        # 3. Upload to Cloudinary
        log(f"[DEBUG] Uploading {audio_path} to Cloudinary...")
        upload_result = cloudinary.uploader.upload(
            audio_path,
            folder="Video-to-audio-Cloudinary",
            resource_type="video"
        )
        
        audio_url = upload_result.get("secure_url")
        log(f"[DEBUG] Upload successful: {audio_url}")

        return {
            "success": True,
            "audioUrl": audio_url
        }

    except Exception as e:
        if LOGS_ENABLED:
            traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating or uploading audio: {str(e)}")
    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                log(f"[DEBUG] Temporary audio file removed: {audio_path}")
            except:
                pass

# ==================== Socket.IO para Streaming ====================

import socketio
import time

# Crear servidor Socket.IO asíncrono
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Envolver la app FastAPI con Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Diccionario para gestionar predictores por SID
active_predictors = {}

@sio.event
async def connect(sid, environ):
    log(f"[Socket.IO] Cliente intentando conectar: {sid}")
    try:
        # Forzar carga para debug si es necesario
        model, labels = LSCEngine.get_model_and_labels()
        
        if model is None:
            print(f"❌ [Socket.IO Error] El modelo NO está cargado. Rechazando {sid}")
            return False

        # Inicializar predictor de streaming
        log(f"[*] Inicializando predictor para {sid}...")
        predictor = LSCStreamingPredictor(
            MODEL_PATH, None, CONFIG_PATH,
            buffer_size=30,
            shared_model=model,
            shared_labels=labels
        )
        
        active_predictors[sid] = predictor
        await sio.emit('status', {'message': 'Connected to Python LSC Model'}, to=sid)
        log(f"✅ [Socket.IO] Conexión aceptada para {sid}")
    except Exception as e:
        print(f"❌ [Socket.IO Error] Excepción en connect para {sid}: {e}")
        traceback.print_exc()
        return False

@sio.event
async def disconnect(sid):
    log(f"[Socket.IO] Cliente desconectado: {sid}")
    if sid in active_predictors:
        del active_predictors[sid]

@sio.on('landmarks')
async def handle_landmarks(sid, data):
    try:
        predictor = active_predictors.get(sid)
        if not predictor:
            return

        # Extraer datos de landmarks
        landmarks_data = data.get('data') if isinstance(data, dict) else data
        
        if not landmarks_data or len(landmarks_data) != 226:
            return

        landmarks = np.array(landmarks_data, dtype=np.float32)
        
        # Predecir usando buffer de streaming (452 features)
        result = predictor.add_landmarks(landmarks)
        
        if result:
            await sio.emit('prediction', {
                "word": result['word'],
                "confidence": float(result['confidence']),
                "buffer_fill": float(result['buffer_fill']),
                "status": result['status']
            }, to=sid)
            
            if LOGS_ENABLED and result['word']:
                log(f"[Socket.IO] Prediction for {sid}: {result['word']}")

    except Exception as e:
        log(f"[Socket.IO Error] Processing landmarks: {e}")

@sio.on('reset')
async def handle_reset(sid):
    if sid in active_predictors:
        active_predictors[sid].reset_buffer()
        await sio.emit('reset_ack', {'message': 'Buffer cleared'}, to=sid)
        log(f"[Socket.IO] Buffer reset for {sid}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    # Importante: Correr socket_app, no app
    uvicorn.run(socket_app, host="0.0.0.0", port=port)
