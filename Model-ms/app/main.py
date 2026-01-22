import sys
import asyncio
import os
from dotenv import load_dotenv

load_dotenv() # Load env vars from .env file
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
from transcription_agent import VoskAgent

app = FastAPI()

# Store active agents to prevent garbage collection and allow stopping
active_agents = {} # room_name -> VoskAgent

# Configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

@app.on_event("startup")
async def startup_event():
    print("🚀 [Startup] Iniciando microservicio Model-ms...")
    try:
        print("[Startup] Pre-cargando modelo COL-NUM-WORD-1101-2...")
        # Forzar carga del singleton
        model, labels = LSCEngine.get_model_and_labels()
        if model is not None:
            print(f"✅ [Startup] Modelo precargado exitosamente. Clases: {len(labels)}")
            # Log de estado de contexto
            context_status = os.getenv("CONTEXT_AWARE_ENABLED", "true").lower() == "true"
            print(f"🎯 [Startup] Inferencia de contexto: {'ACTIVADA' if context_status else 'DESACTIVADA'}")
        else:
            print("❌ [Startup] Error: El modelo no se pudo precargar (es None)")
    except Exception as e:
        print(f"❌ [Startup Error] Fallo crítico cargando modelo: {e}")
        traceback.print_exc()

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
    
    # 1. Check Cloudinary Credentials
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]) or "xxxx" in [cloud_name, api_key, api_secret]:
        raise HTTPException(
            status_code=500, 
            detail="Error: Las credenciales de Cloudinary no están configuradas en el servidor (Model-ms). "
                   "Por favor, configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el archivo .env del backend."
        )

    # 2. Get Text
    text = await _process_video_file(file)
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

class TranscribeRequest(BaseModel):
    room_name: str

@app.post("/transcribe")
async def start_transcription(request: TranscribeRequest):
    room_name = request.room_name
    
    if room_name in active_agents:
        return {"success": True, "message": f"Agent already running in {room_name}"}

    log(f"🚀 [Auto-Transcribe] Spawning agent for room: {room_name}")
    try:
        agent = VoskAgent(room_name)
        # Store it explicitly
        active_agents[room_name] = agent
        
        # Start in background
        asyncio.create_task(agent.start())
        
        return {"success": True, "message": f"Agent spawned for {room_name}"}
    except Exception as e:
        log(f"❌ [Auto-Transcribe Error] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe/stop")
async def stop_transcription(request: TranscribeRequest):
    room_name = request.room_name
    if room_name in active_agents:
        agent = active_agents[room_name]
        await agent.stop()
        del active_agents[room_name]
        return {"success": True, "message": "Agent stopped"}
    return {"success": False, "message": "Agent not found"}

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
    log(f"🔌 [Socket.IO] Intento de conexión: {sid}")
    try:
        # Obtener predictor compartido (ya cargado en startup)
        base_predictor = LSCEngine.get_predictor()
        
        if base_predictor is None:
            log(f"❌ [Socket.IO Error] El predictor NO está listo. Intentando cargar...")
            base_predictor = LSCEngine.get_predictor() # Reintento carga
            if base_predictor is None:
                log(f"❌ [Socket.IO Error] Fallo crítico: modelo inaccesible. Rechazando {sid}")
                return False

        # Inicializar predictor de streaming usando el predictor base compartido
        log(f"[*] Inicializando sesión de streaming para {sid}...")
        predictor = LSCStreamingPredictor(
            base_predictor=base_predictor,
            buffer_size=25  # Reducido de 35 a 25 para mayor agilidad
        )
        
        active_predictors[sid] = predictor
        await sio.emit('status', {'message': 'Connected to Python LSC Model (Optimal)'}, to=sid)
        log(f"✅ [Socket.IO] Conexión aceptada para {sid}")
    except Exception as e:
        if LOGS_ENABLED:
            print(f"❌ [Socket.IO Error] Excepción fatal en connect para {sid}: {e}")
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
                "status": result['status'],
                "context": result.get('current_context'),
                "last_accepted_word": result.get('last_accepted_word'),
                "context_changed": result.get('context_changed', False),
                "distance_alert": result.get('distance_alert')
            }, to=sid)
            
            # Silenciado para enfocarse en logs de GPT-2
            # if LOGS_ENABLED and result['word']:
            #     log(f"[Socket.IO] Prediction for {sid}: {result['word']}")

    except Exception as e:
        log(f"[Socket.IO Error] Processing landmarks: {e}")

@sio.on('reset')
async def handle_reset(sid):
    if sid in active_predictors:
        active_predictors[sid].reset_buffer()
        await sio.emit('reset_ack', {'message': 'Buffer cleared'}, to=sid)
        log(f"[Socket.IO] Buffer reset for {sid}")

@sio.on('word_accepted')
async def handle_word_accepted(sid, data):
    """
    Evento para recibir la palabra aceptada por el usuario en el frontend.
    Data esperado de JS: { "word": "HOLA" } o simplemente "HOLA"
    """
    try:
        word = data.get('word') if isinstance(data, dict) else data
        
        if not word:
            return
            
        if sid in active_predictors:
            active_predictors[sid].set_accepted_word(word)
            # Opcional: Confirmar recepción
            # await sio.emit('context_updated', {'word': word}, to=sid)
        else:
            log(f"[Socket.IO] Warning: 'word_accepted' from unknown sid {sid}")
            
    except Exception as e:
        log(f"[Socket.IO Error] Processing word_accepted: {e}")
@sio.on('set_context')
async def handle_set_context(sid, data):
    try:
        predictor = active_predictors.get(sid)
        if not predictor:
            return
            
        context = data.get('context') if isinstance(data, dict) else data
        predictor.set_context(context)
        
        await sio.emit('context_ack', {'status': 'ok', 'current_context': context}, to=sid)
        log(f"[Socket.IO] Context set to {context} for {sid}")
    except Exception as e:
        log(f"[Socket.IO Error] Setting context: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    # Importante: Correr socket_app, no app
    uvicorn.run(socket_app, host="0.0.0.0", port=port)
