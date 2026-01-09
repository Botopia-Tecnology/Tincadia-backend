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
from lsc_engine import LSCEngine
from lsc_streaming_predictor import LSCStreamingPredictor
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
    log("\n[DEBUG] --- /predict Request ---")
    text = await _process_video_file(file)
    log(f"[DEBUG] Result: {text}")
    return {
        "success": True,
        "text": text
    }

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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating or uploading audio: {str(e)}")
    finally:
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                log(f"[DEBUG] Temporary audio file removed: {audio_path}")
            except:
                pass

# ==================== WebSocket para Streaming ====================

# Diccionario para gestionar sesiones de streaming (conexión -> predictor)
active_sessions = {}

MODEL_PATH = "lsc_model_full_repaired.h5"
LABELS_PATH = "lsc_labels.json"

@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    """
    WebSocket endpoint para predicciones en tiempo real.
    
    Protocolo de mensajes:
    Cliente envía: { "type": "landmarks", "data": [226 números] }
    Servidor responde: { "type": "prediction", "word": "Letra_A", "confidence": 0.85, "status": "predicting" }
    Cliente envía: { "type": "reset" } para limpiar el buffer
    Cliente envía: { "type": "close" } para cerrar conexión
    """
    await websocket.accept()
    session_id = id(websocket)
    
    log(f"[WS] Cliente conectado. Session ID: {session_id}")
    
    try:
        # Crear predictor para esta sesión
        predictor = LSCStreamingPredictor(MODEL_PATH, LABELS_PATH, buffer_size=45)
        active_sessions[session_id] = predictor
        
        # Enviar confirmación de conexión
        await websocket.send_json({
            "type": "connected",
            "message": "Streaming session started",
            "session_id": session_id
        })
        
        while True:
            # Recibir mensaje del cliente
            message = await websocket.receive_json()
            msg_type = message.get("type")
            
            if msg_type == "landmarks":
                # Procesar landmarks
                landmarks_data = message.get("data")
                
                if not landmarks_data or len(landmarks_data) != 226:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Invalid landmarks: expected 226 values, got {len(landmarks_data) if landmarks_data else 0}"
                    })
                    continue
                
                # Convertir a numpy array
                landmarks = np.array(landmarks_data, dtype=np.float32)
                
                # Predecir
                result = predictor.add_landmarks(landmarks)
                
                if result:
                    # Enviar predicción al cliente
                    response = {
                        "type": "prediction",
                        "word": result['word'],
                        "confidence": float(result['confidence']),
                        "buffer_fill": float(result['buffer_fill']),
                        "status": result['status']
                    }
                    await websocket.send_json(response)
                    
                    if LOGS_ENABLED and result['word']:
                        log(f"[WS] Prediction: {result['word']} ({result['confidence']:.2f})")
            
            elif msg_type == "reset":
                # Resetear buffer
                predictor.reset_buffer()
                await websocket.send_json({
                    "type": "reset_confirmed",
                    "message": "Buffer cleared"
                })
                log(f"[WS] Session {session_id} buffer reset")
            
            elif msg_type == "close":
                # Cliente solicita cerrar conexión
                log(f"[WS] Cliente solicitó cerrar sesión {session_id}")
                break
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
    
    except WebSocketDisconnect:
        log(f"[WS] Cliente desconectado. Session ID: {session_id}")
    except Exception as e:
        log(f"[WS ERROR] Session {session_id}: {str(e)}")
        traceback.print_exc()
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        # Limpiar sesión
        if session_id in active_sessions:
            del active_sessions[session_id]
            log(f"[WS] Session {session_id} cleaned up. Active sessions: {len(active_sessions)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
