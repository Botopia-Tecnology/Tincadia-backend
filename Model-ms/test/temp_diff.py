#!/usr/bin/env python3
import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import json
import os
import argparse
from collections import Counter
from typing import Optional, List, Tuple, Dict

class LSCPredictor:
    """
    Clase independiente para el reconocimiento de Lengua de Señas Colombiana (LSC).
    No depende del resto del repositorio, solo requiere:
    - tensorflow
    - opencv-python
    - mediapipe
    - numpy
    """

    def __init__(self, model_path: str, labels_path: str):
        """
        Inicializa el predictor cargando el modelo y las etiquetas.
        
        Args:
            model_path: Ruta al archivo .tflite o .h5
            labels_path: Ruta al archivo .json (etiquetas)
        """
        print(f"[*] Cargando modelo desde: {model_path}")
        
        # CORREGIDO: Soporte para TFLite y TensorFlow
        if model_path.endswith('.tflite'):
            self.interpreter = tf.lite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            self.use_tflite = True
            self.model = None  # No se usa con TFLite
            print("✅ Usando modelo TensorFlow Lite")
        else:
            # Forzar CPU para evitar conflictos de GPU
            tf.config.set_visible_devices([], 'GPU')
            self.model = tf.keras.models.load_model(model_path, compile=False)
            self.use_tflite = False
            self.interpreter = None  # No se usa con TensorFlow normal
            print("✅ Usando modelo TensorFlow (CPU)")
        
        print(f"[*] Cargando etiquetas desde: {labels_path}")
        with open(labels_path, 'r', encoding='utf-8') as f:
            self.labels = json.load(f)
        
        # Convertir llaves a int para búsqueda rápida
        self.id_to_label = {int(k): v for k, v in self.labels.items()}
        
        # Inicializar MediaPipe
        self.mp_holistic = mp.solutions.holistic
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        # Estado para velocidad (Deltas)
        self.prev_norm = None

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
            return coords

    def _predict_from_coords(self, coords: np.ndarray):
        """Predicción desde coordenadas - CORREGIDO"""
        if self.use_tflite:
            # TensorFlow Lite
            input_data = np.expand_dims(coords.astype(np.float32), axis=0)
            self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
            self.interpreter.invoke()
            prediction = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
        else:
            # TensorFlow normal
            input_data = np.expand_dims(coords, axis=0)
            prediction = self.model.predict(input_data, verbose=0)[0]
        
        return prediction

    def _extract_coords(self, results) -> np.ndarray:
        """Extrae las coordenadas de MediaPipe en el formato exacto del modelo (226 valores)."""
        # 1. Pose (25 landmarks * 4: x, y, z, vis) -> 100 valores
        if results.pose_landmarks:
            pose = np.array([[lm.x, lm.y, lm.z, lm.visibility] for lm in results.pose_landmarks.landmark[:25]]).flatten()
        else:
            pose = np.zeros(100)
            
        # 2. Mano Derecha (21 * 3: x, y, z) -> 63 valores
        if results.right_hand_landmarks:
            rh = np.array([[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark]).flatten()
        else:
            rh = np.zeros(63)
            
        # 3. Mano Izquierda (21 * 3: x, y, z) -> 63 valores
        if results.left_hand_landmarks:
            lh = np.array([[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark]).flatten()
        else:
            lh = np.zeros(63)
            
        return np.concatenate([pose, rh, lh])

    def predict_video(self, video_path: str, max_frames: int = 120) -> Optional[str]:
        """
        Procesa un video y devuelve la seña detectada con mayor frecuencia.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"[ERROR] No se pudo abrir el video: {video_path}")
            return None

        predictions = []
        
        self.prev_norm = None  # Resetear estado para nuevo video
        while cap.isOpened() and len(predictions) < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Procesar frame
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.holistic.process(image_rgb)
            
            if results.pose_landmarks or results.right_hand_landmarks or results.left_hand_landmarks:
                raw_coords = self._extract_coords(results)
                norm_coords = self._normalize_landmarks(raw_coords)
                
                # Calcular Delta (Velocidad)
                delta = norm_coords - self.prev_norm if self.prev_norm is not None else np.zeros_like(norm_coords)
                combined = np.concatenate([norm_coords, delta])
                self.prev_norm = norm_coords
                
                # Predicción con 452 valores
                prediction = self._predict_from_coords(combined)
                
                idx = np.argmax(prediction)
                if prediction[idx] > 0.4: # Umbral de confianza
                    predictions.append(self.id_to_label[idx])
        
        cap.release()
        
        if not predictions:
            return None
            
        # Voto por mayoría
        return Counter(predictions).most_common(1)[0][0]

def main():
    parser = argparse.ArgumentParser(description='LSC Standalone Predictor')
    parser.add_argument('--video', type=str, required=True, help='Ruta al video')
    parser.add_argument('--model', type=str, default='lsc_model_full.tflite', help='Archivo .tflite o .h5')
    parser.add_argument('--labels', type=str, default='lsc_labels.json', help='Archivo .json')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.model) or not os.path.exists(args.labels):
        print("[ERROR] No se encuentran los archivos del modelo/etiquetas.")
        print("Asegúrate de haber entrenado el modelo o de tener los archivos .tflite y .json en la carpeta.")
        return

    predictor = LSCPredictor(args.model, args.labels)
    result = predictor.predict_video(args.video)
    
    if result:
        print(f"\n✅ SEÑA DETECTADA: {result}")
    else:
        print("\n❌ No se pudo detectar ninguna seña clara.")

if __name__ == "__main__":
    main()
