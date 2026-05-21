#!/usr/bin/env python3
"""
Loader standalone del Modelo V2. Útil para pruebas rápidas sin el backend.
"""
import os
import sys
import json
import numpy as np
from collections import deque

os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
import tensorflow as tf
tf.config.set_visible_devices([], 'GPU')


class ModeloV2:
    def __init__(self, model_dir: str = "."):
        model_dir = os.path.abspath(model_dir)
        with open(os.path.join(model_dir, "model_config.json"), "r", encoding="utf-8") as f:
            self.config = json.load(f)

        dep_dir = os.path.join(model_dir, "dependencies")
        if dep_dir not in sys.path:
            sys.path.insert(0, dep_dir)

        from coordenates_models_v2 import build_model_v2
        from features_v2 import normalize_frame, add_velocity_features, TOTAL_SIZE, has_hand

        self._normalize_frame = normalize_frame
        self._add_velocity = add_velocity_features
        self._has_hand = has_hand
        self._total_size = TOTAL_SIZE

        info = self.config["model_info"]
        self.frames_per_sequence = info["frames_per_sequence"]
        self.feature_dim = info["feature_dim_per_frame"]
        self.num_classes = info["num_classes"]
        self.classes = self.config["classes"]

        self.model = build_model_v2(
            num_classes=self.num_classes,
            frames_per_sequence=self.frames_per_sequence,
            feature_dim=self.feature_dim,
        )
        self.model.load_weights(os.path.join(model_dir, "weights.hdf5"))

        # Buffer rotativo
        self.buffer = deque(maxlen=self.frames_per_sequence)

        print(f"✅ Modelo {info['name']} cargado")
        print(f"   Accuracy: {info['val_accuracy']:.2%} | Clases: {self.num_classes}")

    def add_frame(self, coords: np.ndarray):
        """Agrega un frame (226,) al buffer."""
        if coords is not None and coords.shape[-1] == self._total_size:
            self.buffer.append(coords.astype(np.float32))

    def clear_buffer(self):
        self.buffer.clear()

    def is_ready(self) -> bool:
        """True cuando el buffer está lleno y hay seña activa."""
        if len(self.buffer) < self.frames_per_sequence:
            return False
        hands = sum(1 for f in self.buffer if self._has_hand(f))
        return hands / self.frames_per_sequence >= 0.5

    def predict(self):
        """Predice sobre el buffer actual. Retorna dict con label, confidence, top3."""
        if not self.is_ready():
            return {"status": "waiting", "label": None, "confidence": 0.0}

        raw_seq = np.array(list(self.buffer))
        norm_seq = np.array([self._normalize_frame(f) for f in raw_seq], dtype=np.float32)
        full_seq = self._add_velocity(norm_seq)

        pred = self.model.predict(np.expand_dims(full_seq, 0), verbose=0)[0]
        top3 = np.argsort(pred)[::-1][:3]
        label = self.classes.get(str(top3[0]), f"Clase_{top3[0]}")
        confidence = float(pred[top3[0]])

        return {
            "status": "ok",
            "label": label,
            "confidence": confidence,
            "top3": [
                {"label": self.classes.get(str(i), f"Clase_{i}"), "confidence": float(pred[i])}
                for i in top3
            ],
        }


if __name__ == "__main__":
    m = ModeloV2()
    # Inferencia dummy
    for _ in range(35):
        m.add_frame(np.random.random(m._total_size).astype(np.float32))
    print(m.predict())
