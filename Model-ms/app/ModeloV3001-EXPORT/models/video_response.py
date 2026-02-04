"""
Modelos Pydantic para las respuestas de los endpoints de video.
"""

from typing import Optional
from pydantic import BaseModel


class VideoToTextResponse(BaseModel):
    """Modelo de respuesta para el endpoint video-to-text."""
    texto: Optional[str]
    confianza: float
    mensaje: str


class VideoToAudioResponse(BaseModel):
    """Modelo de respuesta para el endpoint video-to-audio."""
    audio: Optional[str]  # Base64 encoded audio
    texto: Optional[str]
    formato: Optional[str]  # "mp3" o "wav"
    mensaje: str

