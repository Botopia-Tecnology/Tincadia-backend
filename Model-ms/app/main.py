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
        print("[Startup] Pre-cargando modelo ModeloV3001...")
        # Forzar carga del singleton
        model, labels = LSCEngine.get_model_and_labels()
        if model is not None:
            print(f"✅ [Startup] Modelo precargado exitosamente. Clases: {len(labels)}")
            
            # Pre-cargar GPT-2 en segundo plano para no bloquear el inicio
            print("🧠 [Startup] Iniciando carga de GPT-2 en segundo plano...")
            asyncio.create_task(asyncio.to_thread(LSCEngine.get_llm_resources))
            
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

class TTSRequest(BaseModel):
    text: str

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    text = request.text
    log(f"\n[DEBUG] --- /tts Request: '{text}' ---")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    # 1. Check Cloudinary Credentials
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]) or "xxxx" in [cloud_name, api_key, api_secret]:
        raise HTTPException(
            status_code=500, 
            detail="Error: Cloudinary credentials missing in Model-ms"
        )

    audio_path = None
    try:
        # 2. Generate Audio
        fd, audio_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        log(f"[DEBUG] Generating TTS audio at {audio_path}")
        tts = gTTS(text=text, lang='es')
        tts.save(audio_path)
        
        # 3. Upload to Cloudinary
        log(f"[DEBUG] Uploading to Cloudinary...")
        upload_result = cloudinary.uploader.upload(
            audio_path,
            folder="tincadia/tts",
            resource_type="video" # 'video' allows audio playback in cloudinary
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
        raise HTTPException(status_code=500, detail=f"Error in TTS: {str(e)}")
    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
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
    print(f"🔌 [Socket.IO] Intento de conexión: {sid}")  # Always print, not log()
    try:
        # Obtener predictor compartido (ya cargado en startup)
        base_predictor = LSCEngine.get_predictor()
        print(f"[DEBUG-CONNECT] base_predictor obtenido: {base_predictor is not None}")
        
        if base_predictor is None:
            print(f"❌ [Socket.IO Error] El predictor NO está listo. Intentando cargar...")
            base_predictor = LSCEngine.get_predictor() # Reintento carga
            if base_predictor is None:
                print(f"❌ [Socket.IO Error] Fallo crítico: modelo inaccesible. Rechazando {sid}")
                return False

        # Obtener recursos LLM compartidos
        llm_model, tokenizer = LSCEngine.get_llm_resources()
        print(f"[DEBUG-CONNECT] LLM resources: model={llm_model is not None}, tokenizer={tokenizer is not None}")

        # Inicializar predictor de streaming usando el predictor base compartido
        print(f"[*] Inicializando sesión de streaming para {sid}...")
        predictor = LSCStreamingPredictor(
            base_predictor=base_predictor,
            buffer_size=5,  # Reducido de 25 a 5 para máxima agilidad (igual al evaluador local)
            shared_llm=llm_model,
            shared_tokenizer=tokenizer
        )
        print(f"[DEBUG-CONNECT] Predictor de streaming creado exitosamente para {sid}")
        
        active_predictors[sid] = predictor
        print(f"[DEBUG-CONNECT] Predictor guardado en active_predictors. Total activos: {len(active_predictors)}")
        
        await sio.emit('status', {'message': 'Connected to Python LSC Model (Optimal)'}, to=sid)
        print(f"✅ [Socket.IO] Conexión aceptada para {sid} | Predictor: {'Híbrido (Neural+GPT2)' if predictor.context_aware_enabled else 'Solo Neural'}")
    except Exception as e:
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
    # ALWAYS log cada llamada para debugging crítico
    print(f"⚡ [LANDMARKS-RECV] Evento recibido desde SID: {sid}")
    
    try:
        predictor = active_predictors.get(sid)
        print(f"[LANDMARKS-CHECK] Predictor encontrado: {predictor is not None}")
        
        if not predictor:
            print(f"⚠️ [ERROR] No hay predictor para {sid}. Active: {list(active_predictors.keys())}")
            return

        # Inspección detallada de datos recibidos
        print(f"[LANDMARKS-DATA] Tipo de data recibida: {type(data)}")
        print(f"[LANDMARKS-DATA] Contenido (primeros 200 chars): {str(data)[:200]}")
             
        # Extraer datos de landmarks
        landmarks_data = data.get('data') if isinstance(data, dict) else data
        
        print(f"[LANDMARKS-EXTRACT] Tipo extraído: {type(landmarks_data)}")
        print(f"[LANDMARKS-EXTRACT] Longitud: {len(landmarks_data) if landmarks_data else 'None'}")
        
        if isinstance(landmarks_data, list) and len(landmarks_data) > 0:
            print(f"[LANDMARKS-SAMPLE] Primeros 5 valores: {landmarks_data[:5]}")
            print(f"[LANDMARKS-SAMPLE] Últimos 5 valores: {landmarks_data[-5:]}")

        if not landmarks_data or len(landmarks_data) != 226:
            print(f"❌ [ERROR-VALIDATION] Landmarks inválidos. Len: {len(landmarks_data) if landmarks_data else 'None'}, Esperado: 226")
            return

        print(f"[LANDMARKS-OK] Convirtiendo a numpy array...")
        landmarks = np.array(landmarks_data, dtype=np.float32)
        print(f"[LANDMARKS-OK] Array creado. Shape: {landmarks.shape}, dtype: {landmarks.dtype}")
        
        # Predecir usando buffer de streaming (226 features - shoulder-centered normalization)
        print(f"[LANDMARKS-PREDICT] Llamando a predictor.add_landmarks()...")
        result = predictor.add_landmarks(landmarks)
        print(f"[LANDMARKS-PREDICT] Resultado recibido: {result is not None}")

        if result:
            print(f"[LANDMARKS-RESULT] word={result.get('word')}, conf={result.get('confidence'):.3f}, status={result.get('status')}")

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
            print(f"[LANDMARKS-EMIT] Predicción enviada al cliente {sid}")
            
            # Log de predicciones exitosas
            if result['word'] and result['confidence'] >= 0.5:
                print(f"✨ [PREDICCIÓN-EXITOSA] {result['word']} ({result['confidence']:.2f})")
        else:
            print(f"[LANDMARKS-WARN] add_landmarks retornó None/Empty para {sid}")

    except Exception as e:
        print(f"💥 [EXCEPTION-LANDMARKS] Error procesando: {e}")
        traceback.print_exc()

@sio.on('reset')
async def handle_reset(sid):
    if sid in active_predictors:
        active_predictors[sid].reset_buffer()
        await sio.emit('reset_ack', {'message': 'Buffer cleared'}, to=sid)
        # log(f"[Socket.IO] Buffer reset for {sid}")

@sio.on('word_accepted')
async def handle_word_accepted(sid, data):
    """
    Evento para recibir la palabra aceptada por el usuario en el frontend.
    Data esperado de JS: { "word": "HOLA" } o simplemente "HOLA"
    """
    # log(f"🔔 [Socket.IO] handle_word_accepted from {sid}") # Reduced verbosity
    
    try:
        word = data.get('word') if isinstance(data, dict) else data
        
        if not word:
            log(f"⚠️ [Socket.IO] word_accepted recibido vacío de {sid}")
            return
            
        if sid in active_predictors:
            log(f"✅ [Socket.IO] Palabra aceptada recibida de {sid}: '{word}'")
            active_predictors[sid].set_accepted_word(word)
        else:
            log(f"❌ [Socket.IO] Warning: 'word_accepted' from unknown sid {sid}")
            
    except Exception as e:
        log(f"💥 [Socket.IO Error] Processing word_accepted: {e}")
        traceback.print_exc()
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
