import os
import json
import sys
import traceback
import numpy as np
import tensorflow as tf

# Configuración de archivos - Modelo COL-NUM-WORD-1101-2
MODEL_DIR = os.path.join(os.path.dirname(__file__), "Modelo-COL-NUM-WORD-1101-2-EXPORT")
MODEL_PATH = os.path.join(MODEL_DIR, "weights.hdf5")
CONFIG_PATH = os.path.join(MODEL_DIR, "model_config.json")
LABELS_PATH = os.path.join(MODEL_DIR, "model_config.json")  # Las etiquetas están en el config

# Logging configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

def log(*args, **kwargs):
    """Conditional logging based on LOGS_ENABLED environment variable"""
    if LOGS_ENABLED:
        print(*args, **kwargs)

class LSCEngine:
    """
    Singleton para manejar la carga del modelo y compartirlo entre predictores.
    Usa el modelo COL-NUM-WORD-1101-2 (63 clases: letras, números, colores, palabras)
    """
    _model = None
    _labels = None
    _exacto_predictor = None

    @classmethod
    def _load_resources(cls):
        """Carga el modelo y etiquetas si no están en memoria."""
        if cls._model is None:
            # Check file existence explicitly
            m_exists = os.path.exists(MODEL_PATH)
            c_exists = os.path.exists(CONFIG_PATH)
            
            if m_exists and c_exists:
                log(f"[*] LSCEngine: Cargando recursos desde {MODEL_DIR}...")
                try:
                    # Cargar configuración del modelo
                    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    
                    # Extraer etiquetas del config
                    cls._labels = config.get("classes", {})
                    
                    # Importar arquitectura del modelo
                    deps_path = os.path.join(MODEL_DIR, "dependencies")
                    if deps_path not in sys.path:
                        sys.path.insert(0, deps_path)
                    
                    from coordenates_models import get_model_coord_dense_5
                    
                    # Forzar CPU
                    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
                    tf.config.set_visible_devices([], 'GPU')
                    
                    # Construir modelo
                    cls._model = get_model_coord_dense_5(
                        (config["model_info"]["input_shape"][0],), 
                        config["model_info"]["num_classes"]
                    )
                    
                    # Cargar pesos
                    cls._model.load_weights(MODEL_PATH)
                    
                    # Crear predictor exacto
                    from exacto_predictor_colnumword import ExactoPredictorCOLNUMWORD
                    cls._exacto_predictor = ExactoPredictorCOLNUMWORD(MODEL_PATH, CONFIG_PATH)
                    
                    log(f"✅ LSCEngine: Modelo {config['model_info']['name']} cargado con éxito.")
                except Exception as e:
                    if LOGS_ENABLED:
                        print(f"❌ [LSCEngine Error] Falló la carga del modelo: {e}")
                        traceback.print_exc()
                    cls._model = None
            else:
                if LOGS_ENABLED:
                    print(f"❌ [LSCEngine Error] Archivos no encontrados!")
                    log(f"   MODEL_PATH exists ({m_exists}): {MODEL_PATH}")
                    log(f"   CONFIG_PATH exists ({c_exists}): {CONFIG_PATH}")

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
        """Retorna el predictor exacto COL-NUM-WORD (para videos y landmarks)."""
        cls._load_resources()
        return cls._exacto_predictor

    # Instancia global
engine = LSCEngine()
