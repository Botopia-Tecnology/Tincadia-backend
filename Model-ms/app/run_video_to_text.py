import sys
import os
import json
import tempfile
import requests
from lsc_engine import LSCEngine


def download_video(url: str) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        with open(tmp.name, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return tmp.name
    except Exception as e:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise RuntimeError(f"No se pudo descargar el video: {e}")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No video input"
        }))
        sys.exit(1)

    input_arg = sys.argv[1]
    is_url = input_arg.startswith("http")
    video_path = None

    try:
        if is_url:
            video_path = download_video(input_arg)
        else:
            if not os.path.exists(input_arg):
                raise RuntimeError("El archivo de video no existe")
            video_path = input_arg

        predictor = LSCEngine.get_predictor()
        if predictor is None:
            raise RuntimeError("Modelo no cargado")

        result = predictor.predict_video(video_path)

        if not result:
            raise RuntimeError("No se pudo reconocer ninguna seña")

        # "Letra_L" → "L"
        text = result.replace("Letra_", "")

        print(json.dumps({
            "success": True,
            "text": text
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

    finally:
        if is_url and video_path and os.path.exists(video_path):
            os.remove(video_path)


if __name__ == "__main__":
    main()
