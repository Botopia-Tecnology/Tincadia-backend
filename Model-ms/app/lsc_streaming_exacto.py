#!/usr/bin/env python3
"""
Streaming Predictor compatible con el modelo exacto COL-NUM-WORD-1101-2
Usa el predictor exacto para normalización y predicción
"""
import numpy as np
import tensorflow as tf
import json
import os
from collections import Counter, deque
from typing import Optional, Dict, Tuple
import sys

# Logging configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

def log(*args, **kwargs):
    """Conditional logging based on LOGS_ENABLED environment variable"""
    if LOGS_ENABLED:
        print(*args, **kwargs)

# Importar predictor exacto
from exacto_predictor_colnumword import ExactoPredictorCOLNUMWORD

class LSCStreamingExactoPredictor:
    """
    Predictor de streaming que usa el predictor exacto COL-NUM-WORD-1101-2
    para garantizar compatibilidad 100% con el entrenamiento
    """

    def __init__(self, model_path: str = None, labels_path: str = None, config_path: str = "model_config.json", buffer_size: int = 45, shared_model=None, shared_labels=None, base_predictor=None):
        """
        Inicializa el predictor de streaming exacto.
        Puede recibir un base_predictor ya cargado para ahorrar memoria y tiempo.
        """
        if base_predictor:
            self.exacto_predictor = base_predictor
            log("✅ Usando predictor base compartido para streaming")
        else:
            # Crear predictor exacto (solo si no se pasó uno compartido)
            self.exacto_predictor = ExactoPredictorCOLNUMWORD(model_path, config_path)
            log(f"✅ Nuevo predictor interno creado para streaming")
        
        # Buffer circular para landmarks
        self.buffer_size = buffer_size
        self.landmarks_buffer = deque(maxlen=buffer_size)
        
        # Buffer para predicciones (suavizado)
        self.prediction_buffer = deque(maxlen=10)  # Últimas 10 predicciones
        
        # Estado
        self.frame_count = 0
        self.last_prediction = None
        self.last_accepted_word = None # Nuevo: Contexto de palabra aceptada
        
        log(f"✅ Predictor de streaming listo (buffer: {buffer_size})")

    def set_context(self, word: str):
        """Actualiza el contexto con la última palabra aceptada por el usuario."""
        self.last_accepted_word = word
        log(f"🧠 Contexto actualizado: {word}")

    def add_landmarks(self, landmarks: np.ndarray) -> Optional[Dict]:
        """
        Añade landmarks al buffer usando predictor exacto.
        """
        # Validación básica de forma
        if landmarks.shape[0] != 226:
            return {
                'status': 'error',
                'word': None,
                'confidence': 0,
                'message': f'Invalid landmarks shape: {landmarks.shape}'
            }
        
        # Añadir al buffer
        self.landmarks_buffer.append(landmarks)
        
        # Si el buffer está llenándose (opcional, para evitar ruido muy inicial)
        buffer_fill = len(self.landmarks_buffer) / self.buffer_size
        if buffer_fill < 0.1: # Muy bajo para ser responsivo rápido
            return {
                'status': 'filling_buffer', 
                'word': None, 
                'confidence': 0,
                'buffer_fill': buffer_fill
            }

        # Predecir usando landmarks actuales (sin delta para ABC-1101)
        try:
            # Usar predictor exacto directamente
            result = self.exacto_predictor.predict_from_coords(landmarks.tolist())
            
            if result['status'] != 'ok':
                return {
                    'status': 'error',
                    'word': None,
                    'confidence': 0,
                    'buffer_fill': buffer_fill
                }
            
            confidence = result['confidence']
            predicted_word = result['word']
            
            # Filtrar por confianza
            if confidence >= 0.4:
                self.prediction_buffer.append(predicted_word)
            
            # Suavizado (Smoothing) con Voto Mayoritario
            final_word = None
            if len(self.prediction_buffer) >= 2:  # Reducido de 3 a 2 para mayor rapidez
                # Obtener la palabra más común en las últimas N predicciones
                counts = Counter(self.prediction_buffer)
                most_common = counts.most_common(1)[0]
                
                # Si la más común es suficientemente dominante
                if most_common[1] >= len(self.prediction_buffer) * 0.4:
                    final_word = most_common[0]
            
            # Determinar estatus
            if final_word:
                status = 'predicting'
            elif buffer_fill > 0.05:
                status = 'processing'
            else:
                status = 'uncertain'

            return {
                'status': status,
                'word': final_word,
                'confidence': confidence,
                'buffer_fill': buffer_fill
            }
            
        except Exception as e:
            log(f"[ERROR] Prediction failed: {e}")
            return {'status': 'error', 'word': None, 'confidence': 0}

    def reset_buffer(self):
        """Limpia el buffer de landmarks y predicciones."""
        self.landmarks_buffer.clear()
        self.prediction_buffer.clear()
        self.frame_count = 0
        self.last_prediction = None
        log("[*] Buffer reseteado")

    def get_stats(self) -> Dict:
        """Retorna estadísticas del predictor."""
        return {
            'total_frames': self.frame_count,
            'buffer_size': self.buffer_size,
            'current_buffer_length': len(self.landmarks_buffer),
            'prediction_buffer_length': len(self.prediction_buffer),
            'last_prediction': self.last_prediction,
            'last_accepted_word': self.last_accepted_word
        }

# Para compatibilidad con el código existente
LSCStreamingPredictor = LSCStreamingExactoPredictor
