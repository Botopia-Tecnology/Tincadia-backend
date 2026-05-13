"""
Predictor V2 con buffer rotativo POR SESIÓN.

Diferencia clave con V1:
- V1: stateless. Cada frame → predicción inmediata.
- V2: stateful. Acumula 30 frames en un buffer rotativo, luego predice
      la secuencia completa. Cada conexión necesita su propia instancia.

API compatible con el V1 (mismas firmas `predict_from_coords`, `predict_video`)
para minimizar cambios en `main.py`.
"""
import os
import sys
import numpy as np
from collections import deque
from typing import Optional

LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"


def log(*args, **kwargs):
    if LOGS_ENABLED:
        print(*args, **kwargs)


# Asegurar que las dependencias del export estén disponibles
_MODEL_V2_DIR = os.path.join(os.path.dirname(__file__), "Modelo-V2-Full-Augmented-EXPORT")
_DEPS_PATH = os.path.join(_MODEL_V2_DIR, "dependencies")
if _DEPS_PATH not in sys.path:
    sys.path.insert(0, _DEPS_PATH)

from features_v2 import (
    normalize_frame, add_velocity_features, has_hand, TOTAL_SIZE,
)


class V2StreamingPredictor:
    """
    Predictor con buffer rotativo de 30 frames.

    Uso típico (por sesión):
        predictor = LSCEngineV2.create_predictor()
        for each frame del WebSocket:
            result = predictor.predict_from_coords(coords_list)
            # result["status"] ∈ {"waiting", "no_sign", "ok", "error_shape", "error"}
    """

    def __init__(self, model, config: dict):
        self.model = model
        self.config = config
        info = config["model_info"]
        self.frames_per_sequence = info["frames_per_sequence"]
        self.feature_dim = info["feature_dim_per_frame"]
        self.classes = config["classes"]
        self.num_classes = info["num_classes"]

        # Buffer rotativo de coords crudas (226 por frame)
        self.buffer = deque(maxlen=self.frames_per_sequence)
        # Umbral: porcentaje del buffer que debe tener manos para predecir
        self.hand_ratio_threshold = 0.5

    def add_frame(self, coords: np.ndarray):
        """Agrega un frame al buffer interno."""
        if coords is not None and coords.shape[-1] == TOTAL_SIZE:
            self.buffer.append(coords.astype(np.float32))

    def clear_buffer(self):
        """Limpia el buffer (útil entre videos o al reiniciar sesión)."""
        self.buffer.clear()

    def is_buffer_ready(self) -> bool:
        """True si el buffer está lleno Y la mitad o más tienen manos visibles."""
        if len(self.buffer) < self.frames_per_sequence:
            return False
        hands = sum(1 for f in self.buffer if has_hand(f))
        return hands / self.frames_per_sequence >= self.hand_ratio_threshold

    def predict_from_coords(self, coords_list: list, include_probabilities: bool = False) -> dict:
        """
        Recibe UN frame (226 coords). Lo agrega al buffer y predice si está listo.

        Status codes:
          - "waiting"     → buffer llenándose (primeros frames de la sesión)
          - "no_sign"     → buffer lleno pero sin manos visibles
          - "ok"          → predicción válida sobre los últimos 30 frames
          - "error_shape" → coords no tiene 226 elementos
          - "error"       → excepción durante la inferencia
        """
        try:
            if len(coords_list) != TOTAL_SIZE:
                return {
                    "word": None,
                    "confidence": 0.0,
                    "status": "error_shape",
                }

            coords = np.array(coords_list, dtype=np.float32)
            self.add_frame(coords)

            # Buffer aún llenándose
            if len(self.buffer) < self.frames_per_sequence:
                return {
                    "word": None,
                    "confidence": 0.0,
                    "status": "waiting",
                    "buffer_progress": len(self.buffer),
                    "buffer_size": self.frames_per_sequence,
                }

            # Buffer lleno pero sin manos suficientes
            if not self.is_buffer_ready():
                return {
                    "word": None,
                    "confidence": 0.0,
                    "status": "no_sign",
                }

            # Procesar la secuencia: normalizar + velocidades
            raw_seq = np.array(list(self.buffer))
            norm_seq = np.array([normalize_frame(f) for f in raw_seq], dtype=np.float32)
            full_seq = add_velocity_features(norm_seq)  # (30, 452)

            # Predecir
            pred = self.model.predict(np.expand_dims(full_seq, 0), verbose=0)[0]
            top_idx = int(np.argmax(pred))
            confidence = float(pred[top_idx])
            word = self.classes.get(str(top_idx), f"Clase_{top_idx}")

            result = {
                "word": word,
                "confidence": confidence,
                "class_idx": top_idx,
                "status": "ok",
            }
            if include_probabilities:
                result["probabilities"] = pred.tolist()
            return result

        except Exception as e:
            log(f"[ERROR V2] predict_from_coords falló: {e}")
            return {"word": None, "confidence": 0.0, "status": "error"}

    def predict_landmarks(self, coords_list: list) -> dict:
        """Alias para compatibilidad con código V1."""
        return self.predict_from_coords(coords_list)

    # ============================================================
    # API compatible con LSCStreamingPredictor (V1) para main.py
    # ============================================================

    # Flag de compatibilidad — V2 en Fase 1 NO usa GPT-2 ni contexto
    context_aware_enabled = False

    def add_landmarks(self, landmarks) -> dict:
        """
        API drop-in compatible con LSCStreamingPredictor.add_landmarks (V1).
        Recibe un array/list de 226 floats. Devuelve dict con el mismo schema
        que V1 (con campos de contexto en None porque V2 Fase 1 no los usa).
        """
        coords_list = landmarks.tolist() if hasattr(landmarks, 'tolist') else list(landmarks)
        result = self.predict_from_coords(coords_list)
        buffer_fill = len(self.buffer) / self.frames_per_sequence

        return {
            "word": result.get("word"),
            "confidence": float(result.get("confidence", 0.0)),
            "buffer_fill": float(buffer_fill),
            "status": result["status"],
            # Campos V1 que no aplican en V2 Fase 1
            "current_context": None,
            "last_accepted_word": None,
            "context_changed": False,
            "distance_alert": None,
        }

    def reset_buffer(self):
        """Alias V1-compat de clear_buffer."""
        self.clear_buffer()

    def set_accepted_word(self, word: str):
        """Stub V1-compat — V2 no rastrea contexto en Fase 1."""
        pass

    def set_context(self, context, manual: bool = True):
        """Stub V1-compat — V2 no usa contexto en Fase 1."""
        pass

    def predict_video(self, video_path: str, min_confidence: float = 0.15) -> Optional[str]:
        """
        Predice una palabra desde un video completo.

        IMPORTANTE: Replica el muestreo del entrenamiento — toma 30 frames
        UNIFORMEMENTE ESPACIADOS del video entero (no los últimos 30).
        Así el modelo ve la seña completa, igual que cuando se entrenó.

        El buffer rotativo se usa solo en streaming en vivo (donde no sabes
        cuándo termina la seña).
        """
        import cv2
        import mediapipe as mp

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            log(f"[ERROR V2] No se pudo abrir el video: {video_path}")
            return None

        raw_frames = []
        frames_processed = 0
        frames_with_hands = 0

        mp_holistic = mp.solutions.holistic
        holistic = mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                frames_processed += 1

                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = holistic.process(image_rgb)

                # Lógica de espejo: si detecta solo mano derecha, espeja para
                # mantener consistencia con el entrenamiento.
                if results.right_hand_landmarks and not results.left_hand_landmarks:
                    frame = cv2.flip(frame, 1)
                    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = holistic.process(image_rgb)

                if (results.pose_landmarks
                        or results.right_hand_landmarks
                        or results.left_hand_landmarks):
                    frames_with_hands += 1
                    coords = self._extract_coords(results)
                    raw_frames.append(coords.astype(np.float32))
        finally:
            cap.release()

        log(f"[V2 video] {frames_processed} frames, {frames_with_hands} con manos detectadas")

        if len(raw_frames) < 5:
            log("[V2 video] Muy pocos frames válidos para predecir")
            return None

        # Muestrear 30 frames UNIFORMEMENTE del video entero (igual que en training)
        raw_frames_np = np.array(raw_frames)
        indices = np.linspace(0, len(raw_frames_np) - 1, self.frames_per_sequence, dtype=int)
        sequence = raw_frames_np[indices]  # (30, 226)

        # Procesar igual que training: normalize + velocidades
        norm_seq = np.array([normalize_frame(f) for f in sequence], dtype=np.float32)
        full_seq = add_velocity_features(norm_seq)  # (30, 452)

        # Predicción única sobre la secuencia completa
        pred = self.model.predict(np.expand_dims(full_seq, 0), verbose=0)[0]
        top3 = np.argsort(pred)[::-1][:3]
        top_idx = int(top3[0])
        confidence = float(pred[top_idx])
        word = self.classes.get(str(top_idx), f"Clase_{top_idx}")

        top3_str = ", ".join(
            f"{self.classes.get(str(int(i)), str(i))}({pred[i]:.1%})" for i in top3
        )
        log(f"[V2 video] Predicción: {word} ({confidence:.2%}) | top3: {top3_str}")

        if confidence < min_confidence:
            log(f"[V2 video] Confianza {confidence:.2%} < umbral {min_confidence:.2%}, descartando")
            return None
        return word

    def _extract_coords(self, results) -> np.ndarray:
        """Extrae coords (226,) de un resultado MediaPipe. Mismo layout que V1."""
        if results.pose_landmarks:
            pose = np.array(
                [[lm.x, lm.y, lm.z, lm.visibility]
                 for lm in results.pose_landmarks.landmark[:25]]
            ).flatten()
        else:
            pose = np.zeros(100)

        if results.right_hand_landmarks:
            rh = np.array(
                [[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark]
            ).flatten()
        else:
            rh = np.zeros(63)

        if results.left_hand_landmarks:
            lh = np.array(
                [[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark]
            ).flatten()
        else:
            lh = np.zeros(63)

        return np.concatenate([pose, rh, lh])
