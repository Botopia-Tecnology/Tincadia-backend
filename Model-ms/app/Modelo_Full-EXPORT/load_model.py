#!/usr/bin/env python3
"""Cargador genérico para modelos LSC exportados."""
import os
import json
import numpy as np
import tensorflow as tf

os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
tf.config.set_visible_devices([], 'GPU')


class ModeloLSC:
    def __init__(self, model_dir="."):
        with open(os.path.join(model_dir, "model_config.json"), "r", encoding="utf-8") as f:
            self.config = json.load(f)

        import sys
        sys.path.insert(0, os.path.join(model_dir, "dependencies"))
        from coordenates_models import get_model_coord_dense_5

        self.model = get_model_coord_dense_5(
            (self.config["model_info"]["input_shape"][0],),
            self.config["model_info"]["num_classes"]
        )

        weights_path = os.path.join(model_dir, "weights.hdf5")
        self.model.load_weights(weights_path)

        print(f"✅ Modelo {self.config['model_info']['name']} cargado")
        print(f"📊 Precisión: {self.config['model_info']['val_accuracy']:.2%}")
        print(f"🎯 Clases: {self.config['model_info']['num_classes']}")

    def predict(self, coordinates):
        if len(coordinates.shape) == 1:
            coordinates = np.expand_dims(coordinates, axis=0)

        predictions = self.model.predict(coordinates, verbose=0)
        predicted_idx = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_idx])

        class_idx = str(predicted_idx)
        label = self.config["classes"].get(class_idx, f"Clase_{predicted_idx}")

        return {"label": label, "confidence": confidence, "class_idx": predicted_idx}


if __name__ == "__main__":
    modelo = ModeloLSC()
    dummy = np.random.random(modelo.config["model_info"]["input_shape"][0])
    resultado = modelo.predict(dummy)
    print(f"\nPredicción de ejemplo:")
    print(f"   Señal: {resultado['label']}")
    print(f"   Confianza: {resultado['confidence']:.2%}")
