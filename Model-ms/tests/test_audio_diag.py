import os
from gtts import gTTS
import cloudinary
import cloudinary.uploader
import traceback

def test_audio_generation():
    print("Testing gTTS generation...")
    try:
        text = "Prueba de audio de Tincadia"
        audio_path = "test_audio.mp3"
        tts = gTTS(text=text, lang='es')
        tts.save(audio_path)
        print(f"✅ Audio generated successfully at {audio_path}")
        return audio_path
    except Exception as e:
        print(f"❌ Error generating audio: {e}")
        traceback.print_exc()
        return None

def test_cloudinary_upload(audio_path):
    print("\nTesting Cloudinary upload...")
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    print(f"Cloud Name: {cloud_name}")
    print(f"API Key: {api_key}")
    print(f"API Secret: {'*' * len(api_secret) if api_secret else 'None'}")

    if not all([cloud_name, api_key, api_secret]):
        print("❌ Cloudinary credentials partially or fully missing from environment.")
        return False

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )

    try:
        print(f"Uploading {audio_path} to Cloudinary...")
        upload_result = cloudinary.uploader.upload(
            audio_path,
            folder="Test-Cloudinary",
            resource_type="video"
        )
        audio_url = upload_result.get("secure_url")
        print(f"✅ Upload successful: {audio_url}")
        return True
    except Exception as e:
        print(f"❌ Error uploading to Cloudinary: {e}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    path = test_audio_generation()
    if path:
        test_cloudinary_upload(path)
        if os.path.exists(path):
            os.remove(path)
            print(f"Cleaned up {path}")
