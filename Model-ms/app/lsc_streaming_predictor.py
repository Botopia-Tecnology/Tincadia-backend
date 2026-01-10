#!/usr/bin/env python3
"""
LSC Streaming Predictor - Real-time sign language recognition
Maintains a sliding window buffer and provides continuous predictions
"""
import numpy as np
import tensorflow as tf
import json
from collections import Counter, deque
from typing import Optional, Dict, Tuple
import os


class LSCStreamingPredictor:
    """
    Predictor optimizado para streaming en tiempo real.
    Mantiene un buffer circular de landmarks y predice sobre ventanas deslizantes.
    """

    def __init__(self, model_path: str, labels_path: str, buffer_size: int = 45, shared_model=None, shared_labels=None):
        """
        Inicializa el predictor de streaming.
        
        Args:
            model_path: Ruta al modelo .h5 o .tflite
            labels_path: Ruta al archivo JSON de etiquetas
            buffer_size: Tamaño del buffer (número de frames a mantener)
            shared_model: Modelo pre-cargado (opcional)
            shared_labels: Etiquetas pre-cargadas (opcional)
        """
        if shared_model:
            print("[*] LSCStreamingPredictor: Usando modelo compartido")
            self.model = shared_model
            self.use_tflite = False
            self.interpreter = None
        elif model_path.endswith('.tflite'):
            print(f"[*] Cargando modelo de streaming desde: {model_path}")
            self.interpreter = tf.lite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            self.use_tflite = True
            self.model = None
            print("Usando modelo TensorFlow Lite")
        else:
            print(f"[*] Cargando modelo de streaming desde: {model_path}")
            # Forzar CPU si no está configurado
            if not tf.config.get_visible_devices('GPU'):
                tf.config.set_visible_devices([], 'GPU')
            self.model = tf.keras.models.load_model(model_path, compile=False)
            self.use_tflite = False
            self.interpreter = None
            print("Usando modelo TensorFlow (CPU)")
        
        if shared_labels:
            print("[*] LSCStreamingPredictor: Usando etiquetas compartidas")
            self.labels = shared_labels
        else:
            print(f"[*] Cargando etiquetas desde: {labels_path}")
            with open(labels_path, 'r', encoding='utf-8') as f:
                self.labels = json.load(f)
        
        self.id_to_label = {int(k): v for k, v in self.labels.items()}
        
        # Buffer circular para landmarks
        self.buffer_size = buffer_size
        self.landmarks_buffer = deque(maxlen=buffer_size)
        
        # Buffer para predicciones (suavizado)
        self.prediction_buffer = deque(maxlen=10)  # Últimas 10 predicciones
        
        # Estado
        self.frame_count = 0
        self.last_prediction = None
        
        print(f"Predictor de streaming listo (buffer: {buffer_size} frames)")

    def add_landmarks(self, landmarks: np.ndarray) -> Optional[Dict]:
        """
        Añade landmarks al buffer, gestiona el estado y realiza predicción.
        """
        # Validación básica de forma
        if landmarks.shape[0] != 226:
            return {
                'status': 'error',
                'word': None,
                'confidence': 0,
                'message': f'Invalid landmarks shape: {landmarks.shape}'
            }
            
        # 1. Normalizar landmarks actuales
        norm_coords = self._normalize_landmarks(landmarks)
        
        # 2. Calcular Delta (Velocidad) si tenemos un frame previo
        # Recuperar el último normalizado del buffer (si existe) para calcular delta
        prev_norm = self.landmarks_buffer[-1] if self.landmarks_buffer else np.zeros_like(norm_coords)
        
        delta = norm_coords - prev_norm
        
        # 3. Combinar [Landmarks (226) + Delta (226)] = 452 features
        combined_features = np.concatenate([norm_coords, delta])
        
        # Añadir al buffer (guardamos solo el normalizado base para el cálculo de delta del siguiente frame)
        self.landmarks_buffer.append(norm_coords)
        
        # Si el buffer está llenándose (opcional, para evitar ruido muy inicial)
        buffer_fill = len(self.landmarks_buffer) / self.buffer_size
        if buffer_fill < 0.1: # Muy bajo para ser responsivo rápido
            return {
                'status': 'filling_buffer', 
                'word': None, 
                'confidence': 0,
                'buffer_fill': buffer_fill
            }

        # 4. Predecir usando los 452 features
        try:
            prediction_probs = self._predict_from_coords(combined_features)
            
            # Obtener mejor clase
            class_idx = np.argmax(prediction_probs)
            confidence = float(prediction_probs[class_idx])
            
            predicted_word = None
            
            # 5. Filtrar por confianza
            if confidence >= 0.4:
                predicted_word = self.id_to_label.get(class_idx, "Unknown")
                self.prediction_buffer.append(predicted_word)
            
            # 6. Suavizado (Smoothing) con Voto Mayoritario
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

    def _normalize_landmarks(self, coords: np.ndarray) -> np.ndarray:
        """
        Aplica la misma normalización usada durante el entrenamiento:
        Centrado en hombros y escalado por distancia entre ellos.
        MANTIENE CEROS para evitar falsas detecciones (letra O).
        """
        try:
            # 1. Descomponer
            pose_coords = coords[:100].reshape(25, 4).copy()
            hands_coords = coords[100:].reshape(42, 3).copy()
            
            LEFT_SHOULDER = 11
            RIGHT_SHOULDER = 12
            
            # 2. Calcular centro y escala (x, y, z)
            ls = pose_coords[LEFT_SHOULDER, :3]
            rs = pose_coords[RIGHT_SHOULDER, :3]
            
            if np.all(ls == 0) or np.all(rs == 0):
                return coords.flatten()

            center = (ls + rs) / 2
            shoulder_dist = np.linalg.norm(ls - rs)
            
            # 3. Normalizar (x, y, z) SOLO a puntos que NO sean cero
            pose_mask = np.any(pose_coords[:, :3] != 0, axis=1)
            pose_coords[pose_mask, :3] -= center
            
            hands_mask = np.any(hands_coords != 0, axis=1)
            hands_coords[hands_mask] -= center
            
            if shoulder_dist > 1e-6:
                pose_coords[pose_mask, :3] /= shoulder_dist
                hands_coords[hands_mask] /= shoulder_dist
            
            # 4. Recomponer
            return np.concatenate([pose_coords.flatten(), hands_coords.flatten()])
        except Exception as e:
            print(f"[ERROR] Normalización falló: {e}")
            return coords

    def _predict_from_coords(self, coords: np.ndarray) -> np.ndarray:
        """Ejecuta predicción sobre landmarks normalizados."""
        if self.use_tflite:
            input_data = np.expand_dims(coords.astype(np.float32), axis=0)
            self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
            self.interpreter.invoke()
            prediction = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
        else:
            # TensorFlow normal - LLAMADA DIRECTA (-) OVERHEAD
            input_data = np.expand_dims(coords, axis=0)
            prediction = self.model(input_data, training=False).numpy()[0]
        
        return prediction

    def get_stats(self) -> Dict:
        """Retorna estadísticas del predictor."""
        return {
            'total_frames': self.frame_count,
            'buffer_size': self.buffer_size,
            'current_buffer_length': len(self.landmarks_buffer),
            'prediction_buffer_length': len(self.prediction_buffer),
            'last_prediction': self.last_prediction
        }
