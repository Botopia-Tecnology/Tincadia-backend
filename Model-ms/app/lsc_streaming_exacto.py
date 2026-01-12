#!/usr/bin/env python3
"""
Streaming Predictor compatible con el modelo exacto ABC-1101
Usa el predictor exacto para normalización y predicción
"""
import numpy as np
import tensorflow as tf
import json
from collections import Counter, deque
from typing import Optional, Dict, Tuple
import os
import sys

# Importar predictor exacto
from exacto_predictor_abc1101 import ExactoPredictorABC1101

class LSCStreamingExactoPredictor:
    """
    Predictor de streaming que usa el predictor exacto ABC-1101
    para garantizar compatibilidad 100% con el entrenamiento
    """

    def __init__(self, model_path: str, labels_path: str, config_path: str = "model_config.json", buffer_size: int = 45, shared_model=None, shared_labels=None):
        """
        Inicializa el predictor de streaming exacto.
        """
        # Crear predictor exacto
        self.exacto_predictor = ExactoPredictorABC1101(model_path, config_path)
        
        # Buffer circular para landmarks
        self.buffer_size = buffer_size
        self.landmarks_buffer = deque(maxlen=buffer_size)
        
        # Buffer para predicciones (suavizado)
        self.prediction_buffer = deque(maxlen=10)  # Últimas 10 predicciones
        
        # Estado
        self.frame_count = 0
        self.last_prediction = None
        
        print(f"Predictor de streaming exacto listo (buffer: {buffer_size} frames)")

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
            if len(self.prediction_buffer) >= 3:
                # Obtener la palabra más común en las últimas N predicciones
                counts = Counter(self.prediction_buffer)
                most_common = counts.most_common(1)[0]
                
                # Si la más común aparece al menos el 50% de las veces en el buffer
                if most_common[1] >= len(self.prediction_buffer) / 2:
                    final_word = most_common[0]
            
            return {
                'status': 'predicting' if final_word else 'uncertain',
                'word': final_word,
                'confidence': confidence,
                'buffer_fill': buffer_fill
            }
            
        except Exception as e:
            print(f"[ERROR] Prediction failed: {e}")
            return {'status': 'error', 'word': None, 'confidence': 0}

    def reset_buffer(self):
        """Limpia el buffer de landmarks y predicciones."""
        self.landmarks_buffer.clear()
        self.prediction_buffer.clear()
        self.frame_count = 0
        self.last_prediction = None
        print("[*] Buffer reseteado")

    def get_stats(self) -> Dict:
        """Retorna estadísticas del predictor."""
        return {
            'total_frames': self.frame_count,
            'buffer_size': self.buffer_size,
            'current_buffer_length': len(self.landmarks_buffer),
            'prediction_buffer_length': len(self.prediction_buffer),
            'last_prediction': self.last_prediction
        }

# Para compatibilidad con el código existente
LSCStreamingPredictor = LSCStreamingExactoPredictor
