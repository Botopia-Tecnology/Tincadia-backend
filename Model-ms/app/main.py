import sys
import os
import json
import tempfile
import requests
import traceback
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from lsc_engine import LSCEngine

app = FastAPI()

@app.post("/predict")
async def predict_video(request: Request, file: UploadFile = File(...)):
    # --- LOGS DE DEPURACIÓN ---
    print("\n[DEBUG] --- Petición Recibida ---")
    print(f"[DEBUG] Headers: {request.headers}")
    content_type = request.headers.get('content-type', 'Sin Content-Type')
    print(f"[DEBUG] Content-Type: {content_type}")
    # --------------------------

    video_path = None
    try:
        # Crear archivo temporal cerrándolo inmediatamente para evitar bloqueo en Windows
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp.close() 
        video_path = tmp.name
        
        # Guardar el archivo subido
        content = await file.read()
        print(f"[DEBUG] Tamaño del archivo recibido: {len(content)} bytes")
        
        with open(video_path, "wb") as f:
            f.write(content)

        print(f"[*] Video guardado temporalmente en: {video_path}")

        predictor = LSCEngine.get_predictor()
        if predictor is None:
            raise HTTPException(status_code=500, detail="Modelo no cargado")

        result = predictor.predict_video(video_path)

        if not result:
            raise HTTPException(status_code=422, detail="No se pudo reconocer ninguna seña")

        # "Letra_L" → "L"
        text = result.replace("Letra_", "")
        print(f"[DEBUG] Resultado: {text}")

        return {
            "success": True,
            "text": text
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        print(f"ERROR INTERNO: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    finally:
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except:
                pass
