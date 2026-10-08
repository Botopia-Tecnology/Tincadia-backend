import os
import sys
import urllib.request
import zipfile
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

URL = "https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip"
TARGET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_DIR = os.path.join(TARGET_DIR, "vosk-model-es-0.42")
ZIP_PATH = os.path.join(TARGET_DIR, "vosk-model-es-0.42.zip")

def download_and_extract():
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    if os.path.exists(MODEL_DIR) and os.path.isdir(MODEL_DIR):
        # Verify contents
        items = os.listdir(MODEL_DIR)
        if "am" in items and "graph" in items:
            print(f"✅ El modelo ya está descargado y extraído en: {MODEL_DIR}")
            return

    print(f"📥 Descargando modelo Vosk grande (1.4 GB) desde:\n  {URL}")
    print(f"📂 Destino temporal: {ZIP_PATH}")
    
    start_time = time.time()
    last_print_time = start_time
    
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(ZIP_PATH, "wb") as out_file:
        total_size = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024 # 1 MB
        
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            
            now = time.time()
            if now - last_print_time >= 5 or downloaded == total_size:
                elapsed = now - start_time
                mb_downloaded = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                pct = (downloaded / total_size * 100) if total_size else 0
                speed = mb_downloaded / elapsed if elapsed > 0 else 0
                print(f"⏳ Progreso: {mb_downloaded:.1f} MB / {mb_total:.1f} MB ({pct:.1f}%) - Velocidad: {speed:.2f} MB/s")
                last_print_time = now

    print(f"✅ Descarga completada en {time.time() - start_time:.1f} segundos.")
    print("📦 Extrayendo archivos en models/...")
    
    extract_start = time.time()
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(TARGET_DIR)
    
    print(f"✅ Extracción completada en {time.time() - extract_start:.1f} segundos.")
    
    # Remove zip file
    if os.path.exists(ZIP_PATH):
        try:
            os.remove(ZIP_PATH)
            print("🧹 Archivo zip temporal eliminado para liberar espacio.")
        except Exception as e:
            print(f"⚠️ No se pudo eliminar zip temporal: {e}")

    print(f"🎉 ¡Modelo listo en: {MODEL_DIR}!")

if __name__ == "__main__":
    download_and_extract()
