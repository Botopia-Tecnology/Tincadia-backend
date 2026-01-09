import os
from lsc_standalone_predictor import LSCPredictor

# Configuración de archivos - CORREGIDO
MODEL_PATH = "lsc_model_full_repaired.h5"  # ✅ Usando H5 para máxima precisión
LABELS_PATH = "lsc_labels.json"

class LSCEngine:
    """
    Singleton para manejar la carga del modelo.
    Esto evita que el modelo de 200MB se cargue varias veces en memoria
    si tenemos múltiples archivos de rutas.
    """
    _predictor = None

    @classmethod
    def get_predictor(cls):
        if cls._predictor is None:
            if os.path.exists(MODEL_PATH) and os.path.exists(LABELS_PATH):
                print("[*] LSCEngine: Cargando modelo por primera vez...")
                cls._predictor = LSCPredictor(MODEL_PATH, LABELS_PATH)
            else:
                print("[WARNING] LSCEngine: Archivos de modelo no encontrados.")
        return cls._predictor

# Instancia global para importar en otros archivos
engine = LSCEngine()
