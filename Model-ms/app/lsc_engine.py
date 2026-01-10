import os
import json
import tensorflow as tf
from lsc_standalone_predictor import LSCPredictor

# Configuración de archivos
MODEL_PATH = "lsc_model_full_repaired.h5"
LABELS_PATH = "lsc_labels.json"

class LSCEngine:
    """
    Singleton para manejar la carga del modelo y compartirlo entre predictores.
    Evita redundancia de memoria (200MB+) y reduce latencia de conexión.
    """
    _model = None
    _labels = None
    _standalone_predictor = None

    @classmethod
    def _load_resources(cls):
        """Carga el modelo y etiquetas si no están en memoria."""
        if cls._model is None:
            if os.path.exists(MODEL_PATH) and os.path.exists(LABELS_PATH):
                print(f"[*] LSCEngine: Cargando recursos desde {MODEL_PATH}...")
                
                # Cargar Etiquetas
                with open(LABELS_PATH, 'r', encoding='utf-8') as f:
                    cls._labels = json.load(f)
                
                # Cargar Modelo (Forzar CPU para evitar conflictos)
                if not tf.config.get_visible_devices('GPU'):
                    tf.config.set_visible_devices([], 'GPU')
                cls._model = tf.keras.models.load_model(MODEL_PATH, compile=False)
                print("✅ LSCEngine: Recursos cargados con éxito.")
            else:
                print(f"[WARNING] LSCEngine: Archivos no encontrados en {MODEL_PATH}")

    @classmethod
    def get_model(cls):
        cls._load_resources()
        return cls._model

    @classmethod
    def get_labels(cls):
        cls._load_resources()
        return cls._labels

    @classmethod
    def get_model_and_labels(cls):
        """Retorna una tupla con el modelo y etiquetas."""
        return cls.get_model(), cls.get_labels()

    @classmethod
    def get_predictor(cls):
        """Retorna el predictor standalone (para videos)."""
        if cls._standalone_predictor is None:
            model = cls.get_model()
            labels = cls.get_labels()
            if model and labels:
                cls._standalone_predictor = LSCPredictor(
                    MODEL_PATH, LABELS_PATH, 
                    shared_model=model, 
                    shared_labels=labels
                )
        return cls._standalone_predictor

# Instancia global
engine = LSCEngine()
