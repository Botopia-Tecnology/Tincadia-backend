import os
import json
import sys
import numpy as np
import tensorflow as tf

# Configuración de archivos - Nuevo Modelo ABC-1101
MODEL_PATH = "weights.hdf5"
CONFIG_PATH = "model_config.json"
LABELS_PATH = "lsc_labels.json"

class LSCEngine:
    """
    Singleton para manejar la carga del modelo y compartirlo entre predictores.
    Usa el predictor exacto ABC-1101 para compatibilidad 100%
    """
    _model = None
    _labels = None
    _exacto_predictor = None

    @classmethod
    def _load_resources(cls):
        """Carga el modelo y etiquetas si no están en memoria."""
        if cls._model is None:
            if os.path.exists(MODEL_PATH) and os.path.exists(CONFIG_PATH) and os.path.exists(LABELS_PATH):
                print(f"[*] LSCEngine: Cargando recursos desde {MODEL_PATH}...")
                
                # Cargar configuración del modelo
                with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # Cargar Etiquetas
                with open(LABELS_PATH, 'r', encoding='utf-8') as f:
                    cls._labels = json.load(f)
                
                # Importar arquitectura del nuevo modelo
                sys.path.insert(0, "dependencies")
                from coordenates_models import get_model_coord_dense_5
                
                # Forzar CPU para evitar conflictos con DirectML
                os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
                tf.config.set_visible_devices([], 'GPU')
                
                # Construir modelo con arquitectura del nuevo modelo
                cls._model = get_model_coord_dense_5(
                    (config["model_info"]["input_shape"][0],), 
                    config["model_info"]["num_classes"]
                )
                
                # Cargar pesos
                cls._model.load_weights(MODEL_PATH)
                
                # Crear predictor exacto
                from exacto_predictor_abc1101 import ExactoPredictorABC1101
                cls._exacto_predictor = ExactoPredictorABC1101(MODEL_PATH, CONFIG_PATH)
                
                print(f"✅ LSCEngine: Modelo {config['model_info']['name']} cargado con éxito.")
                print(f"📊 Precisión: {config['model_info']['val_accuracy']:.2%}")
            else:
                print(f"[WARNING] LSCEngine: Archivos no encontrados")

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
        """Retorna el predictor exacto ABC-1101 (para videos y landmarks)."""
        cls._load_resources()
        return cls._exacto_predictor

    # Instancia global
engine = LSCEngine()
