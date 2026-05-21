"""
Singleton de carga del modelo V2 (BiGRU sobre secuencias de 30 frames).

Diseñado para coexistir con `lsc_engine.py` (V1) sin tocarlo. La selección
entre V1 y V2 se hace al nivel de `main.py` (próximo paso).
"""
import os
import sys
import json
import traceback

import numpy as np
import tensorflow as tf

LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"


def log(*args, **kwargs):
    if LOGS_ENABLED:
        print(*args, **kwargs)


# Ruta del paquete V2 exportado (mismo patrón que ModeloV3001-EXPORT en V1)
MODEL_V2_DIR = os.path.join(os.path.dirname(__file__), "Modelo-V2-Full-Augmented-EXPORT")
MODEL_V2_PATH = os.path.join(MODEL_V2_DIR, "weights.hdf5")
CONFIG_V2_PATH = os.path.join(MODEL_V2_DIR, "model_config.json")


class LSCEngineV2:
    """
    Singleton para el modelo V2.

    - Carga la arquitectura BiGRU desde `dependencies/coordenates_models_v2.py`.
    - Lee `weights.hdf5` y `model_config.json` del export.
    - Expone `get_model()`, `get_config()`, y un factory `create_predictor()`
      que devuelve una nueva instancia de `V2StreamingPredictor` por sesión
      (cada WebSocket debe tener su propio buffer).
    """
    _model = None
    _config = None

    @classmethod
    def _load_resources(cls):
        if cls._model is not None:
            return

        if not os.path.exists(MODEL_V2_PATH) or not os.path.exists(CONFIG_V2_PATH):
            log(f"❌ [LSCEngineV2] Archivos no encontrados:")
            log(f"   weights: {MODEL_V2_PATH} (exists: {os.path.exists(MODEL_V2_PATH)})")
            log(f"   config:  {CONFIG_V2_PATH} (exists: {os.path.exists(CONFIG_V2_PATH)})")
            return

        log(f"[*] LSCEngineV2: Cargando desde {MODEL_V2_DIR}...")
        try:
            with open(CONFIG_V2_PATH, 'r', encoding='utf-8') as f:
                cls._config = json.load(f)

            deps_path = os.path.join(MODEL_V2_DIR, "dependencies")
            if deps_path not in sys.path:
                sys.path.insert(0, deps_path)

            from coordenates_models_v2 import build_model_v2

            os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
            tf.config.set_visible_devices([], 'GPU')

            info = cls._config["model_info"]
            cls._model = build_model_v2(
                num_classes=info["num_classes"],
                frames_per_sequence=info["frames_per_sequence"],
                feature_dim=info["feature_dim_per_frame"],
            )
            cls._model.load_weights(MODEL_V2_PATH)

            log(f"✅ LSCEngineV2 listo. "
                f"Accuracy: {info['val_accuracy']:.2%} | Clases: {info['num_classes']}")
        except Exception as e:
            log(f"❌ [LSCEngineV2 Error] {e}")
            if LOGS_ENABLED:
                traceback.print_exc()
            cls._model = None
            cls._config = None

    @classmethod
    def get_model(cls):
        cls._load_resources()
        return cls._model

    @classmethod
    def get_config(cls):
        cls._load_resources()
        return cls._config

    @classmethod
    def get_labels(cls):
        """Alias compatible con la API de LSCEngine (V1)."""
        cls._load_resources()
        return cls._config["classes"] if cls._config else None

    @classmethod
    def create_predictor(cls):
        """
        Crea una nueva instancia de V2StreamingPredictor.
        Cada sesión/WebSocket debe llamar esto para tener su propio buffer.
        """
        cls._load_resources()
        if cls._model is None:
            return None
        from v2_streaming_predictor import V2StreamingPredictor
        return V2StreamingPredictor(cls._model, cls._config)


# Instancia global (paralela a `engine` del V1)
engine_v2 = LSCEngineV2()
