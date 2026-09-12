import asyncio
import os
import json
import logging
import sys
from livekit import api, rtc
from vosk import Model, KaldiRecognizer
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("VoskAgent")

# Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
AGENT_IDENTITY_PREFIX = "transcriber-"
# Log Vosk partial hypotheses (verbose). Set TRANSCRIBE_LOG_PARTIALS=true to debug audio pipeline.
LOG_TRANSCRIBE_PARTIALS = os.getenv("TRANSCRIBE_LOG_PARTIALS", "").lower() in ("1", "true", "yes")

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

# Si el bot queda solo en la sala, se auto-desconecta pasados estos segundos.
# Sin esto la sala nunca queda vacia, empty_timeout nunca dispara y LiveKit
# sigue facturando minutos de participante indefinidamente.
LONELY_TIMEOUT = int(os.getenv("TRANSCRIBE_LONELY_TIMEOUT", "60"))
# Gracia para que el primer humano entre. El bot se lanza al crear la sala, asi
# que puede pasar un rato hasta que alguien se conecte de verdad.
JOIN_GRACE = int(os.getenv("TRANSCRIBE_JOIN_GRACE", "300"))
# Tope duro de vida del agente, como red de seguridad final.
MAX_SESSION_SECONDS = int(os.getenv("TRANSCRIBE_MAX_SESSION_SECONDS", str(4 * 60 * 60)))


def normalize_speech_chunk(pcm_bytes: bytes) -> bytes:
    """
    Normalizador dinámico inteligente de voz (Soft-Knee Limiter + Automatic Speech Boost):
    - Amplifica suavemente la voz baja o que habla "pasito" (hasta +11dB / 3.5x).
    - No amplifica la voz que ya viene fuerte (evita distorsión).
    - Aplica limitador suave analógico (soft knee a partir de 0.75) para evitar saturación digital (clipping).
    - Noise Gate: no amplifica el silencio ni el ruido de fondo de la habitación en pausas.
    """
    if not pcm_bytes:
        return pcm_bytes

    try:
        samples = np.frombuffer(pcm_bytes, dtype=np.int16)
        audio = samples.astype(np.float32) / 32768.0
        rms = float(np.sqrt(np.mean(audio**2)))

        NOISE_GATE = 0.005   # ~ -46 dBFS (piso de ruido ambiente)
        TARGET_RMS = 0.12   # ~ -18 dBFS (nivel óptimo para extracción acústica MFCC en Kaldi)

        if rms > NOISE_GATE:
            # Ganancia adaptativa suave entre 1.0x (sin cambio) y 3.5x (+11dB)
            gain = max(min(TARGET_RMS / (rms + 1e-6), 3.5), 1.0)
            boosted = audio * gain

            # Limitador analógico suave (soft-knee limiter a partir de 0.75)
            abs_boosted = np.abs(boosted)
            mask = abs_boosted > 0.75
            if np.any(mask):
                over = (abs_boosted[mask] - 0.75) / 0.25
                compressed = 0.75 + 0.245 * np.tanh(over)
                boosted[mask] = np.sign(boosted[mask]) * compressed

            return (boosted * 32767.0).astype(np.int16).tobytes()

        return pcm_bytes
    except Exception as e:
        logger.warning(f"Error normalizando audio chunk: {e}")
        return pcm_bytes


class VoskAgent:
    def __init__(self, room_name: str):
        self.room_name = room_name
        self.room = rtc.Room()
        self.audio_streams = {} # participant_identity -> AudioStream
        # El bot entra a la sala ANTES que la persona. Hasta que no se confirme
        # que hubo al menos un humano, "sala vacia" significa "todavia no llego",
        # no "ya se fue": cerrar ahi mataba la transcripcion recien iniciada.
        self._seen_human = False
        self.is_running = False
        self.on_closed = None  # callback opcional para que main.py limpie active_agents
        self._watchdog_task = None

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

        @self.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            if not participant.identity.startswith(AGENT_IDENTITY_PREFIX):
                self._seen_human = True
                print(f"[Bot] Humano en la sala: {participant.identity}")

        @self.room.on("participant_disconnected")
        def on_participant_disconnected(participant: rtc.RemoteParticipant):
            print(f"[Bot] Salio de la sala: {participant.identity}")
            self.stop_transcription(participant.identity)
            if self._seen_human and self._human_count() == 0:
                print(f"[Bot] No quedan humanos en {self.room_name}, cerrando en {LONELY_TIMEOUT}s...")
                asyncio.create_task(self._close_if_still_alone())

        @self.room.on("disconnected")
        def on_disconnected():
            print(f"[Bot] Desconectado de la sala: {self.room_name}")
            self.is_running = False
            self._notify_closed()

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
            # Quien ya estaba en la sala antes de que entrara el bot no dispara
            # participant_connected, asi que se contabiliza aqui.
            if self._human_count() > 0:
                self._seen_human = True
            # Watchdog: garantiza que el bot nunca quede colgado en la sala.
            self._watchdog_task = asyncio.create_task(self._watchdog())
        except Exception as e:
            print(f"❌ [Bot] ERROR de conexión: {e}")
            self.is_running = False
            self._notify_closed()

    def _human_count(self) -> int:
        """Participantes remotos que no son agentes transcriptores."""
        return sum(
            1 for p in self.room.remote_participants.values()
            if not p.identity.startswith(AGENT_IDENTITY_PREFIX)
        )

    def _notify_closed(self):
        if self.on_closed:
            try:
                self.on_closed(self.room_name)
            except Exception as e:
                print(f"⚠️ [Bot] Error en callback on_closed: {e}")
            finally:
                self.on_closed = None

    async def _close_if_still_alone(self):
        """Espera LONELY_TIMEOUT y cierra si nadie volvio a entrar."""
        await asyncio.sleep(LONELY_TIMEOUT)
        if not self.is_running:
            return
        if self._human_count() > 0:
            print(f"↩️ [Bot] Alguien volvio a {self.room_name}, cancelando cierre.")
            return
        print(f"🧹 [Bot] Sala {self.room_name} sin humanos, desconectando para no facturar de mas.")
        await self.stop()

    async def _watchdog(self):
        """Red de seguridad: cierra si nunca llega nadie o si se excede el tope de sesion."""
        loop = asyncio.get_event_loop()
        started = loop.time()

        # Margen de gracia inicial para que el humano alcance a conectarse.
        # JOIN_GRACE es mas amplio que LONELY_TIMEOUT porque aqui se compite
        # con el arranque de la llamada, no con una salida.
        await asyncio.sleep(JOIN_GRACE)
        if self.is_running and not self._seen_human and self._human_count() == 0:
            print(f"🧹 [Bot] Nadie entro a {self.room_name} tras {JOIN_GRACE}s, cerrando.")
            await self.stop()
            return

        while self.is_running:
            restante = MAX_SESSION_SECONDS - (loop.time() - started)
            if restante <= 0:
                break
            # Nunca dormir mas alla del tope de sesion, asi el cap dispara a tiempo
            # aunque sea mas corto que el intervalo de chequeo.
            await asyncio.sleep(min(30, restante))
            # Si el evento participant_disconnected no llego (caida de red, etc.)
            # este chequeo periodico igual detecta la sala vacia.
            if self.is_running and self._seen_human and self._human_count() == 0:
                print(f"🧹 [Bot] Watchdog: {self.room_name} quedo sin humanos, cerrando.")
                await self.stop()
                return

        if self.is_running:
            print(f"⏰ [Bot] Tope de sesion ({MAX_SESSION_SECONDS}s) alcanzado en {self.room_name}, cerrando.")
            await self.stop()

    async def stop(self):
        if not self.is_running and self._watchdog_task is None:
            return
        self.is_running = False
        if self._watchdog_task:
            self._watchdog_task.cancel()
            self._watchdog_task = None
        try:
            await self.room.disconnect()
        except Exception as e:
            print(f"⚠️ [Bot] Error desconectando de {self.room_name}: {e}")
        self._notify_closed()

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

    def dispatch_transcription(self, speaker_identity: str, text: str, is_final: bool):
        """Envía transcripciones en segundo plano sin bloquear el consumo del stream de audio."""
        if not self.is_running:
            return
        asyncio.create_task(self.publish_transcription(speaker_identity, text, is_final))

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
            print(f"❌ [Bot] Error publicando datos: {e}")

    async def transcribe_loop(self, participant: rtc.RemoteParticipant, stream: rtc.AudioStream):
        vosk_model = get_model()
        # Vosk small espera PCM 16 kHz mono (KaldiRecognizer sample rate = salida del resampler).
        vosk_sample_rate = 16000
        rec = KaldiRecognizer(vosk_model, vosk_sample_rate)
        rec.SetWords(True)
        # AudioResampler(input_rate, output_rate, *, num_channels=...)
        resampler = None

        identity = participant.identity
        print(f"🎙️ [Bot] Reconocimiento optimizado para {identity} (16kHz + Streaming Buffer estilo Google Meet)...")

        # 1. Framing Acústico: 4,000 muestras @ 16kHz 16-bit mono = 8,000 bytes (~250ms de audio continuo)
        # Idéntico al bloque usado en transcribe_audio_file (wf.readframes(4000))
        CHUNK_SIZE = 8000
        audio_buffer = bytearray()

        # 2. Control de estado y rate-limiting de parciales
        last_partial_text = ""
        last_partial_time = 0.0
        last_speech_time = 0.0
        PARTIAL_THROTTLE_SECONDS = 0.20  # Máximo ~5 parciales por segundo

        # 3. Watchdog de silencio para auto-commit (Endpointing estilo Google Meet)
        # Si el usuario habló y hace una pausa de ~850ms, forzar commit para que la frase se consolide
        SILENCE_COMMIT_TIMEOUT = 0.85
        SILENCE_BURST = b'\x00' * 3200  # 100ms de confort-silencio para disparar el endpointer de Kaldi

        loop = asyncio.get_event_loop()

        try:
            print(f"🕵️ [Bot] Pipeline de audio en tiempo real activo para {identity}...")
            async for event in stream:
                if identity not in self.audio_streams or not self.is_running:
                    break

                frame = event.frame
                now = loop.time()

                if resampler is None:
                    input_rate = int(frame.sample_rate)
                    if input_rate < 8000:
                        input_rate = 48000
                        print(f"⚠️ [Bot] sample_rate dudoso ({frame.sample_rate}), usando {input_rate}Hz como entrada")
                    num_ch = int(frame.num_channels) if frame.num_channels >= 1 else 1
                    resampler = rtc.AudioResampler(
                        input_rate,
                        vosk_sample_rate,
                        num_channels=num_ch,
                    )
                    print(f"🔧 [Bot] Resampler: {input_rate}Hz → {vosk_sample_rate}Hz, canales={num_ch}")

                resampled_frames = resampler.push(frame)

                for out_frame in resampled_frames:
                    audio_buffer.extend(out_frame.data.tobytes())

                    # Procesamos en bloques acústicos continuos (~250ms)
                    while len(audio_buffer) >= CHUNK_SIZE:
                        chunk = bytes(audio_buffer[:CHUNK_SIZE])
                        del audio_buffer[:CHUNK_SIZE]

                        # Normalización inteligente de voz suave con limitador analógico anti-clipping
                        chunk = normalize_speech_chunk(chunk)

                        if rec.AcceptWaveform(chunk):
                            result = json.loads(rec.Result())
                            text = (result.get('text') or '').strip()
                            if text:
                                print(f"✨ [Bot] FINAL: {text}")
                                last_partial_text = ""
                                last_speech_time = 0.0
                                self.dispatch_transcription(identity, text, is_final=True)
                        else:
                            # Hipótesis parcial desacoplada con rate-limiting y deduplicación
                            if now - last_partial_time >= PARTIAL_THROTTLE_SECONDS:
                                partial = json.loads(rec.PartialResult())
                                partial_text = (partial.get('partial') or '').strip()
                                if partial_text:
                                    last_speech_time = now
                                    if partial_text != last_partial_text:
                                        last_partial_text = partial_text
                                        last_partial_time = now
                                        if LOG_TRANSCRIBE_PARTIALS:
                                            print(f"💭 [Bot] PARCIAL: {partial_text}")
                                        self.dispatch_transcription(identity, partial_text, is_final=False)

                # Endpointing de silencio (Google Meet auto-commit):
                # Si había habla activa y el orador ha pausado por más de SILENCE_COMMIT_TIMEOUT
                if last_partial_text and (now - last_speech_time > SILENCE_COMMIT_TIMEOUT):
                    # Alimentar silencio para que el lattice de Kaldi cierre la hipótesis fonética
                    if rec.AcceptWaveform(SILENCE_BURST):
                        res = json.loads(rec.Result())
                        final_text = (res.get('text') or '').strip()
                    else:
                        res = json.loads(rec.Result())
                        final_text = (res.get('text') or '').strip()

                    if final_text:
                        print(f"✨ [Bot] FINAL (silence commit): {final_text}")
                        last_partial_text = ""
                        last_speech_time = 0.0
                        self.dispatch_transcription(identity, final_text, is_final=True)
                    else:
                        last_partial_text = ""
                        last_speech_time = 0.0

            # Al salir del stream (desconexión o fin de llamada), vaciar lo que quede en buffer
            if len(audio_buffer) > 0:
                rec.AcceptWaveform(normalize_speech_chunk(bytes(audio_buffer)))
            final_res = json.loads(rec.FinalResult())
            final_text = (final_res.get('text') or '').strip()
            if final_text:
                print(f"✨ [Bot] FINAL (flush): {final_text}")
                await self.publish_transcription(identity, final_text, is_final=True)

        except Exception as e:
            print(f"❌ [Bot] Error en el loop de {identity}: {e}")
        finally:
            self.stop_transcription(identity)

def transcribe_audio_file(input_path: str) -> str:
    """
    Transcribe a local audio file (m4a/mp3/wav/ogg/…) with Vosk.
    Converts to 16 kHz mono WAV via ffmpeg, then runs KaldiRecognizer.
    """
    import subprocess
    import tempfile
    import wave

    vosk_model = get_model()
    if vosk_model is None:
        raise RuntimeError("Modelo Vosk no cargado")

    wav_path = None
    try:
        fd, wav_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"ffmpeg falló al convertir audio: {err[-500:]}")

        rec = KaldiRecognizer(vosk_model, 16000)
        rec.SetWords(True)

        parts = []
        with wave.open(wav_path, "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                raise RuntimeError("El WAV convertido no es 16kHz mono PCM")

            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                data = normalize_speech_chunk(data)
                if rec.AcceptWaveform(data):
                    payload = json.loads(rec.Result())
                    text = (payload.get("text") or "").strip()
                    if text:
                        parts.append(text)

            final_payload = json.loads(rec.FinalResult())
            final_text = (final_payload.get("text") or "").strip()
            if final_text:
                parts.append(final_text)

        return " ".join(parts).strip()
    finally:
        if wav_path and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass


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

