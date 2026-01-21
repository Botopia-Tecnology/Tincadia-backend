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
        
        # Contexto y pesos
        self.current_context = None
        self.context_weights = {
            "Colores": ["Amarillo", "Azul", "Blanco", "Café", "Gris", "Morado", "Naranja", "Negro", "Rojo", "Rosado", "Verde"],
            "Numeros": ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"],
            "Letras": [f"Letra_{c}" for c in "ABCDEFGHIJKLMNÑOPQRSTUVWXY"],
            "Saludos": ["Hola", "Chao", "BIENVENIDO", "Buenas-noches", "Buenas-tardes", "Buenos-dias", "COMO-ESTA", "CON-GUSTO", "Gracias", "De-nada", "PERMISO", "Perdon", "Por-favor"]
        }
        
        # Historial para inferencia automática
        self.word_history = deque(maxlen=5)
        
        # Toggle para activar/desactivar inferencia de contexto
        self.context_aware_enabled = os.getenv("CONTEXT_AWARE_ENABLED", "true").lower() == "true"
        self.auto_context_enabled = self.context_aware_enabled
        
        log(f"✅ Predictor de streaming listo (buffer: {buffer_size}, context_aware: {self.context_aware_enabled})")

    def set_context(self, context_name: Optional[str], manual: bool = True):
        """Establece el contexto actual. Si es manual, desactiva la inferencia automática temporalmente."""
        if manual and context_name is not None:
            self.auto_context_enabled = False
        elif manual and context_name is None:
            self.auto_context_enabled = True

        if context_name in self.context_weights or context_name is None:
            self.current_context = context_name
            log(f"🎯 Contexto {'(MANUAL)' if manual else '(AUTO)'} cambiado a: {context_name}")
        else:
            log(f"⚠️ Contexto desconocido: {context_name}")

    def _infer_context_automatic(self, last_word: str):
        """Infiere el contexto basado en la última palabra y el historial."""
        if not self.context_aware_enabled or not self.auto_context_enabled:
            return

        # 1. Búsqueda directa por categoría
        new_context = None
        for ctx, words in self.context_weights.items():
            if last_word in words:
                new_context = ctx
                break
        
        # 2. Si se encontró una categoría clara, cambiar
        if new_context and new_context != self.current_context:
            self.set_context(new_context, manual=False)
            return True
        
        return False

    def _apply_context_boost(self, probabilities: list) -> Tuple[int, float]:
        """Aplica un refuerzo a las probabilidades según el contexto actual."""
        if not self.current_context:
            idx = np.argmax(probabilities)
            return idx, probabilities[idx]

        boosted_probs = np.array(probabilities).copy()
        target_labels = self.context_weights.get(self.current_context, [])
        
        # Obtener mapeo de etiquetas del predictor
        classes_map = self.exacto_predictor.config["classes"]
        
        for idx_str, label in classes_map.items():
            idx = int(idx_str)
            if label in target_labels:
                # Boost por un factor (ej. 1.5) para favorecer el contexto
                boosted_probs[idx] *= 1.8
        
        # Volver a normalizar para que sumen 1 (opcional, pero util para confianza real)
        boosted_probs = boosted_probs / np.sum(boosted_probs)
        
        new_idx = np.argmax(boosted_probs)
        return new_idx, boosted_probs[new_idx]

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
        
        # Verificar distancia del usuario
        distance_alert = self._check_distance(landmarks)
        
        if buffer_fill < 0.1: # Muy bajo para ser responsivo rápido
            return {
                'status': 'filling_buffer', 
                'word': None, 
                'confidence': 0,
                'buffer_fill': buffer_fill,
                'distance_alert': distance_alert
            }

        # Predecir usando landmarks actuales (con probabilidades para contexto)
        try:
            # Usar predictor exacto pidiendo todas las probabilidades
            result = self.exacto_predictor.predict_from_coords(landmarks.tolist(), include_probabilities=True)
            
            if result['status'] != 'ok':
                return {
                    'status': 'error',
                    'word': None,
                    'confidence': 0,
                    'buffer_fill': buffer_fill
                }
            
            # Aplicar lógica de contexto si existe y está habilitada
            if self.context_aware_enabled and self.current_context:
                predicted_idx, confidence = self._apply_context_boost(result['probabilities'])
                predicted_word = self.exacto_predictor.config["classes"].get(str(predicted_idx), f"Clase_{predicted_idx}")
            else:
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
            context_changed = False
            if final_word:
                status = 'predicting'
                # Inferencia automática cuando la palabra se estabiliza y es nueva
                if not self.word_history or self.word_history[-1] != final_word:
                    self.word_history.append(final_word)
                    context_changed = self._infer_context_automatic(final_word)
            elif buffer_fill > 0.05:
                status = 'processing'
            else:
                status = 'uncertain'

            return {
                'status': status,
                'word': final_word,
                'confidence': confidence,
                'buffer_fill': buffer_fill,
                'current_context': self.current_context,
                'context_changed': context_changed,
                'distance_alert': distance_alert
            }
            
        except Exception as e:
            log(f"[ERROR] Prediction failed: {e}")
            return {'status': 'error', 'word': None, 'confidence': 0, 'distance_alert': None}

    def _check_distance(self, landmarks: np.ndarray) -> Optional[str]:
        """
        Verifica si el usuario está muy cerca o muy lejos basándose en los hombros.
        Pose landmarks 11 (hombro izquierdo) y 12 (hombro derecho).
        """
        try:
            # Los primeros 100 valores son la pose (25 landmarks * 4: x, y, z, vis)
            # 11: left shoulder, 12: right shoulder
            # Cada landmark ocupa 4 espacios
            
            # Landmark 11 -> indices 44, 45, 46, 47 (x, y, z, v)
            # Landmark 12 -> indices 48, 49, 50, 51 (x, y, z, v)
            
            x11 = landmarks[44]
            y11 = landmarks[45]
            v11 = landmarks[47]
            
            x12 = landmarks[48]
            y12 = landmarks[49]
            v12 = landmarks[51]
            
            # Si la visibilidad es muy baja, no podemos confiar
            if v11 < 0.5 or v12 < 0.5:
                # Si ambos están en 0, es que no se detecta pose
                if x11 == 0 and x12 == 0:
                    return "NO_USER"
                return None
            
            # Calcular distancia Euclidiana 2D entre hombros
            shoulder_width = np.sqrt((x11 - x12)**2 + (y11 - y12)**2)
            
            if shoulder_width < 0.001:
                return "NO_USER"
            
            # Umbrales basados en pruebas empíricas (coordenadas normalizadas 0-1)
            # 0.15 = Muy lejos
            # 0.45 = Muy cerca
            
            if shoulder_width < 0.18:
                return "TOO_FAR"
            elif shoulder_width > 0.50:
                return "TOO_CLOSE"
            
            return "OK"
            
        except Exception as e:
            log(f"[DEBUG] Error checking distance: {e}")
            return None

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
            'last_prediction': self.last_prediction
        }

# Para compatibilidad con el código existente
LSCStreamingPredictor = LSCStreamingExactoPredictor
