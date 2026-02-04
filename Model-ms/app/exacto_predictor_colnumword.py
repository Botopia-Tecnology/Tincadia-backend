#!/usr/bin/env python3
"""
Predictor exacto para ModeloV3001
Usa la misma normalización min-max que el entrenamiento original
Modelo con 99 clases: letras, números, colores, palabras...
"""
import os
import json
import sys
import numpy as np
import tensorflow as tf

# Logging configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

def log(*args, **kwargs):
    """Conditional logging based on LOGS_ENABLED environment variable"""
    if LOGS_ENABLED:
        print(*args, **kwargs)

class ExactoPredictorCOLNUMWORD:
    """
    Predictor que usa exactamente la misma normalización
    que el entrenamiento original del ModeloV3001
    """
    
    def __init__(self, model_path=None, config_path=None, model=None):
        """
        Inicializar predictor. 
        Puede recibir rutas para cargar todo, o un objeto 'model' ya cargado.
        """
        if config_path:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        else:
            self.config = None

        if model:
            self.model = model
            log("✅ Usando instancia de modelo compartida")
        elif model_path and config_path:
            # Obtener directorio del modelo
            model_dir = os.path.dirname(model_path)
            
            # Importar arquitectura
            sys.path.insert(0, os.path.join(model_dir, "dependencies"))
            from coordenates_models import get_model_coord_dense_5
            
            # Forzar CPU
            os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
            tf.config.set_visible_devices([], 'GPU')
            
            # Construir y cargar modelo
            self.model = get_model_coord_dense_5(
                (self.config["model_info"]["input_shape"][0],), 
                self.config["model_info"]["num_classes"]
            )
            self.model.load_weights(model_path)
            log(f"✅ Modelo {self.config['model_info']['name']} cargado desde disco")
        
        if self.config:
            log(f"📊 Precisión: {self.config['model_info']['val_accuracy']:.2%}")
            log(f"🎯 Clases: {self.config['model_info']['num_classes']}")
    
    def normalize_landmarks_exacto(self, coords: np.ndarray) -> np.ndarray:
        """
        Normalización exacta min-max como en el entrenamiento original
        """
        try:
            # Descomponer coordenadas
            pose_coords = coords[:100].reshape(25, 4).copy()
            hands_coords = coords[100:].reshape(42, 3).copy()
            
            # Extraer solo x, y, z para normalización
            pose_xyz = pose_coords[:, :3]  # (25, 3)
            hands_xyz = hands_coords  # (42, 3)
            
            # Normalización min-max para pose (solo puntos no cero)
            pose_mask = np.any(pose_xyz != 0, axis=1)
            if np.any(pose_mask):
                pose_valid = pose_xyz[pose_mask]
                pose_min = pose_valid.min(axis=0)
                pose_max = pose_valid.max(axis=0)
                pose_range = pose_max - pose_min
                
                # Evitar división por cero
                pose_range[pose_range == 0] = 1
                
                # Normalizar solo puntos válidos
                pose_xyz[pose_mask] = (pose_xyz[pose_mask] - pose_min) / pose_range
            
            # Normalización min-max para manos (solo puntos no cero)
            hands_mask = np.any(hands_xyz != 0, axis=1)
            if np.any(hands_mask):
                hands_valid = hands_xyz[hands_mask]
                hands_min = hands_valid.min(axis=0)
                hands_max = hands_valid.max(axis=0)
                hands_range = hands_max - hands_min
                
                # Evitar división por cero
                hands_range[hands_range == 0] = 1
                
                # Normalizar solo puntos válidos
                hands_xyz[hands_mask] = (hands_xyz[hands_mask] - hands_min) / hands_range
            
            # Recomponer con visibility intacta
            pose_coords[:, :3] = pose_xyz
            hands_coords[:, :] = hands_xyz
            
            return np.concatenate([pose_coords.flatten(), hands_coords.flatten()])
            
        except Exception as e:
            log(f"[ERROR] Normalización exacta falló: {e}")
            return coords
    
    def predict_from_coords(self, coords_list: list, include_probabilities: bool = False) -> dict:
        """
        Predice desde lista de coordenadas con normalización exacta
        """
        try:
            if len(coords_list) != 226:
                return {
                    "word": None,
                    "confidence": 0.0,
                    "status": "error_shape"
                }
            
            coords = np.array(coords_list, dtype=np.float32)
            
            # Usar la normalización exacta
            norm_coords = self.normalize_landmarks_exacto(coords)
            
            # Predecir con el modelo
            coords_reshaped = np.expand_dims(norm_coords, axis=0)
            predictions = self.model.predict(coords_reshaped, verbose=0)
            predicted_idx = np.argmax(predictions[0])
            confidence = predictions[0][predicted_idx]
            
            # Obtener etiqueta
            class_idx = str(predicted_idx)
            if class_idx in self.config["classes"]:
                label = self.config["classes"][class_idx]
            else:
                label = f"Clase_{predicted_idx}"
            
            result = {
                "word": label,
                "confidence": float(confidence),
                "class_idx": int(predicted_idx),
                "status": "ok"
            }

            if include_probabilities:
                result["probabilities"] = predictions[0].tolist()
            
            return result
            
        except Exception as e:
            log(f"[ERROR] Predicción desde coords falló: {e}")
            return {
                "word": None,
                "confidence": 0.0,
                "status": "error"
            }
    
    def predict_landmarks(self, coords_list: list) -> dict:
        """
        Alias de predict_from_coords para compatibilidad con código antiguo
        """
        return self.predict_from_coords(coords_list)
    
    def predict_video(self, video_path: str) -> str:
        """
        Predice desde video usando normalización exacta
        """
        import cv2
        import mediapipe as mp
        from collections import Counter
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            log(f"[ERROR] No se pudo abrir el video: {video_path}")
            return None

        predictions = []
        
        # Inicializar MediaPipe
        mp_holistic = mp.solutions.holistic
        holistic = mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        try:
            frames_processed = 0
            frames_with_hands = 0
            mirror_triggers = 0
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frames_processed += 1
                
                # Procesar frame
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = holistic.process(image_rgb)
                
                # Lógica de Espejo: Si detecta mano derecha pero no izquierda, invertir frame
                if results.right_hand_landmarks and not results.left_hand_landmarks:
                    frame = cv2.flip(frame, 1)
                    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = holistic.process(image_rgb)
                    mirror_triggers += 1
                
                if results.pose_landmarks or results.right_hand_landmarks or results.left_hand_landmarks:
                    frames_with_hands += 1
                    # Extraer coordenadas
                    coords = self._extract_coords(results)
                    
                    # Predecir directamente (predict_from_coords ya normaliza)
                    result = self.predict_from_coords(coords.tolist())
                    
                    if result['status'] == 'ok' and result['confidence'] > 0.3:
                        predictions.append(result['word'])
        
        finally:
            cap.release()
            
        log(f"[DEBUG_PREDICTOR] Video processed: {frames_processed} frames")
        log(f"[DEBUG_PREDICTOR] Hands detected in: {frames_with_hands} frames")
        log(f"[DEBUG_PREDICTOR] Mirror Logic triggered: {mirror_triggers} times")
        
        if not predictions:
            log("[DEBUG_PREDICTOR] No confident predictions found.")
            return None
            
        # Voto por mayoría
        counts = Counter(predictions)
        log(f"[DEBUG_PREDICTOR] Prediction Stats: {counts}")
        return counts.most_common(1)[0][0]
    
    def _extract_coords(self, results) -> np.ndarray:
        """Extrae coordenadas en el formato exacto del modelo (226 valores)"""
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

# Para compatibilidad con el backend actual
def create_exact_predictor():
    """Crea predictor exacto compatible con backend"""
    model_dir = os.path.join(os.path.dirname(__file__), "ModeloV3001-EXPORT")
    return ExactoPredictorCOLNUMWORD(
        os.path.join(model_dir, "weights.hdf5"),
        os.path.join(model_dir, "model_config.json")
    )

if __name__ == "__main__":
    # Prueba rápida
    predictor = create_exact_predictor()
    
    # Probar con coordenadas dummy
    dummy_coords = np.random.random(226).astype(np.float32)
    result = predictor.predict_from_coords(dummy_coords.tolist())
    
    print(f"\n🔮 Prueba de predicción exacta:")
    print(f"   Señal: {result['word']}")
    print(f"   Confianza: {result['confidence']:.2%}")
    print(f"   Estado: {result['status']}")
