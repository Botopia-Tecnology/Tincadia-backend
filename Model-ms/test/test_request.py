import requests
import sys
import os

def test_prediction(video_path):
    url = "http://127.0.0.1:8000/predict"
    
    if not os.path.exists(video_path):
        print(f"Error: El archivo '{video_path}' no existe.")
        return

    print(f"Enviando video: {video_path}...")
    
    try:
        with open(video_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, files=files)
        
        print(f"Status Code: {response.status_code}")
        print("Respuesta:")
        print(response.json())
        
    except Exception as e:
        print(f"Error al conectar con la API: {e}")
        try:
            print("Response text raw:")
            print(response.text)
        except:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python test_request.py <ruta_al_video>")
    else:
        test_prediction(sys.argv[1])
