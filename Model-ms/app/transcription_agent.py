import asyncio
import os
import json
import logging
import sys
from livekit import api, rtc
from vosk import Model, KaldiRecognizer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("VoskAgent")

# Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
AGENT_IDENTITY_PREFIX = "transcriber-"

# Vosk Model Path
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "vosk-model-small-es-0.42")

if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "models/vosk-model-small-es-0.42"

# Global model instance
model = None

def get_model():
    global model
    if model is None:
        if os.path.exists(MODEL_PATH):
            print(f"📦 [Bot] Cargando modelo desde: {MODEL_PATH}")
            model = Model(MODEL_PATH)
            print("✅ [Bot] Modelo cargado.")
        else:
            print(f"❌ [Bot] ERROR: Modelo no encontrado en {MODEL_PATH}")
            # Diagnostic info only
            try:
                print(f"🔍 [Bot] Files in root: {os.listdir(os.path.dirname(MODEL_PATH))}")
            except: pass
    return model

class VoskAgent:
    def __init__(self, room_name: str):
        self.room_name = room_name
        self.room = rtc.Room()
        self.audio_streams = {} # participant_identity -> AudioStream
        self.is_running = False

    async def start(self):
        if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            print("❌ [Bot] Faltan credenciales de LiveKit (URL, KEY o SECRET)")
            return

        # Ensure model is loaded
        if get_model() is None:
            print("❌ [Bot] No se puede iniciar: El modelo no cargó.")
            return

        self.is_running = True
        
        # Setup event handlers
        @self.room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                print(f"🎙️ [Bot] Suscripto a audio de: {participant.identity}")
                self.start_transcription(participant, track)

        @self.room.on("track_unsubscribed")
        def on_track_unsubscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                print(f"🔇 [Bot] Desuscripto de: {participant.identity}")
                self.stop_transcription(participant.identity)

        @self.room.on("disconnected")
        def on_disconnected():
            print(f"🔌 [Bot] Desconectado de la sala: {self.room_name}")
            self.is_running = False

        # Connect
        print(f"📡 [Bot] Conectando a sala {self.room_name} en {LIVEKIT_URL}...")
        try:
            token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
                .with_identity(f"{AGENT_IDENTITY_PREFIX}{self.room_name}") \
                .with_name("AI Transcriber") \
                .with_grants(api.VideoGrants(
                    room_join=True, 
                    room=self.room_name, 
                    can_publish=True, 
                    can_subscribe=True,
                    can_publish_data=True
                )) \
                .to_jwt()

            await self.room.connect(LIVEKIT_URL, token)
            print(f"✅ [Bot] CONECTADO exitosamente a {self.room_name}")
        except Exception as e:
            print(f"❌ [Bot] ERROR de conexión: {e}")
            self.is_running = False

    async def stop(self):
        self.is_running = False
        await self.room.disconnect()

    def start_transcription(self, participant: rtc.RemoteParticipant, track: rtc.Track):
        identity = participant.identity
        if identity in self.audio_streams:
            return

        stream = rtc.AudioStream(track)
        self.audio_streams[identity] = stream
        asyncio.create_task(self.transcribe_loop(participant, stream))

    def stop_transcription(self, identity: str):
        if identity in self.audio_streams:
            del self.audio_streams[identity]

    async def publish_transcription(self, speaker_identity: str, text: str, is_final: bool):
        try:
            data = json.dumps({
                "type": "transcription",
                "speakerId": speaker_identity,
                "text": text,
                "isFinal": is_final,
                "timestamp": asyncio.get_event_loop().time()
            }).encode('utf-8')
            
            await self.room.local_participant.publish_data(data, reliable=is_final)
        except Exception as e:
            logger.error(f"[{self.room_name}] Failed to publish data: {e}")

    async def transcribe_loop(self, participant: rtc.RemoteParticipant, stream: rtc.AudioStream):
        vosk_model = get_model()
        sample_rate = 48000
        rec = KaldiRecognizer(vosk_model, sample_rate)
        
        # El resampler asegura que no importa a qué frecuencia transmita el usuario,
        # Vosk reciba siempre la misma frecuencia (48kHz en este caso).
        resampler = rtc.AudioResampler(sample_rate, 1) # 1 channel (mono)
        
        identity = participant.identity
        logger.info(f"[{self.room_name}] Loop started for {identity} (Resampling to {sample_rate}Hz)")

        try:
            async for event in stream:
                if identity not in self.audio_streams or not self.is_running:
                    break
                    
                # Resample frames before feeding to Vosk
                resampled_frames = resampler.push(event.frame)
                
                for frame in resampled_frames:
                    data = frame.data.tobytes()
                    
                    if rec.AcceptWaveform(data):
                        result = json.loads(rec.Result())
                        text = result.get('text', '')
                        if text:
                            # log(f"[{self.room_name}] {identity}: {text}")
                            await self.publish_transcription(identity, text, is_final=True)
                    else:
                        partial = json.loads(rec.PartialResult())
                        partial_text = partial.get('partial', '')
                        if partial_text:
                            await self.publish_transcription(identity, partial_text, is_final=False)
        except Exception as e:
            logger.error(f"[{self.room_name}] Error in loop for {identity}: {e}")
        finally:
            self.stop_transcription(identity)

# For manual testing
async def main():
    room = os.getenv("ROOM_NAME")
    if room:
        agent = VoskAgent(room)
        await agent.start()
        # Keep alive
        while True:
            await asyncio.sleep(1)
    else:
        print("Set ROOM_NAME env var to test manually")

if __name__ == "__main__":
    asyncio.run(main())

