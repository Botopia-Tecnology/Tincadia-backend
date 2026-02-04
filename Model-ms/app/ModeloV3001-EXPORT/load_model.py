#!/usr/bin/env python3
"""
Script simple para cargar y usar el ModeloV3001
"""
import os
import json
import numpy as np
import tensorflow as tf

# Forzar CPU para compatibilidad
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
tf.config.set_visible_devices([], 'GPU')

class ModeloLSC:
    def __init__(self, model_dir="."):
        """Cargar el modelo desde el directorio especificado"""
        
        # Si model_dir es ".", usar ruta absoluta del archivo
        if model_dir == ".":
            model_dir = os.path.dirname(os.path.abspath(__file__))

        self.model_dir = model_dir
        
        # Cargar configuración
        config_path = os.path.join(model_dir, "model_config.json")
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        
        # Importar arquitectura
        import sys
        sys.path.insert(0, os.path.join(model_dir, "dependencies"))
        from coordenates_models import get_model_coord_dense_5
        
        # Construir modelo
        self.model = get_model_coord_dense_5(
            (self.config["model_info"]["input_shape"][0],), 
            self.config["model_info"]["num_classes"]
        )
        
        # Cargar pesos
        weights_path = os.path.join(model_dir, "weights.hdf5")
        if os.path.exists(weights_path):
            self.model.load_weights(weights_path)
            print(f"✅ Modelo {self.config['model_info']['name']} cargado exitosamente")
            print(f"📊 Precisión: {self.config['model_info']['val_accuracy']:.2%}")
            print(f"🎯 Clases: {self.config['model_info']['num_classes']}")
        else:
            print(f"❌ Error: No se encontró el archivo de pesos en {weights_path}")
            return

    def predict(self, coordinates):
        """Realizar predicción con coordenadas normalizadas"""
        if len(coordinates.shape) == 1:
            coordinates = np.expand_dims(coordinates, axis=0)
        
        predictions = self.model.predict(coordinates, verbose=0)
        predicted_idx = np.argmax(predictions[0])
        confidence = predictions[0][predicted_idx]
        
        # Obtener etiqueta
        class_idx = str(predicted_idx)
        if class_idx in self.config["classes"]:
            label = self.config["classes"][class_idx]
        else:
            label = f"Clase_{predicted_idx}"
        
        return {
            "label": label,
            "confidence": float(confidence),
            "class_idx": int(predicted_idx)
        }

# Ejemplo de uso
if __name__ == "__main__":
    # Cargar modelo desde el directorio actual
    modelo_lsc = ModeloLSC()
    
    # Predicción de ejemplo (coordenadas aleatorias de 226 dimensiones)
    dummy_coords = np.random.random(226)
    resultado = modelo_lsc.predict(dummy_coords)
    
    print("\n🔮 Predicción de ejemplo (Ruido):")
    print(f"   Señal: {resultado['label']}")
    print(f"   Confianza: {resultado['confidence']:.2%}")
    print(f"   Índice: {resultado['class_idx']}")
