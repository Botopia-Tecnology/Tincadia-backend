# ModeloV3001 - Reconocimiento LSC (Lengua de Señas Colombiana)

Este es el último modelo entrenado (30 de enero de 2026) exportado como una versión independiente.

## 📊 Información del Modelo
- **Nombre:** ModeloV3001
- **Precisión (Val):** 34.99%
- **Pérdida (Val):** 2.3546
- **Clases:** 99 (Abecedario, Números, Palabras comunes)
- **Arquitectura:** get_model_coord_dense_5
- **Input Shape:** (226,) - Pose + Manos normalizadas
- **Fecha de Entrenamiento:** 2026-01-30

## 📁 Estructura de la Exportación
- `weights.hdf5`: Pesos entrenados del modelo.
- `model_config.json`: Metadatos y mapeo de clases.
- `load_model.py`: Clase `ModeloLSC` para cargar y predecir fácilmente.
- `dependencies/`: Arquitectura del modelo.
- `models/`: Modelos de datos y variables auxiliares.
- `utils/`: Herramientas para detección de landmarks (Mediapipe).

## 🚀 Uso Rápido

```python
from load_model import ModeloLSC

# Cargar modelo
modelo = ModeloLSC()
```
# Predecir con un array de coordenadas de 226 dimensiones
# resultado = modelo.predict(coordinates_array)
# print(f"Seña: {resultado['label']} ({resultado['confidence']:.2%})")

## 📋 Requisitos
- tensorflow==2.10.0
- opencv-python==4.6.0.66
- mediapipe==0.10.11
- numpy>=1.21.0

---
Generado automáticamente por Antigravity.
