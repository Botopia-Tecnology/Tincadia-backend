# Modelo-V2-Full-Augmented

Modelo V2 LSC entrenado sobre secuencias de 30 frames con arquitectura Bidirectional GRU.

## Specs

- Accuracy (val): **85.94%**
- Clases: **159**
- Input shape: `(30, 452)` — 30 frames × 452 features
- Features por frame: 226 coords (pose + manos) + 226 velocidades
- Arquitectura: Bidirectional GRU(128) → BiGRU(64) → Dense(128) → Dense(num_classes)

## Estructura

```
Modelo-V2-Full-Augmented-EXPORT/
├── weights.hdf5              # Pesos del modelo
├── model_config.json         # Metadata + clases
├── load_model_v2.py          # Loader standalone
├── README.md
└── dependencies/
    ├── coordenates_models_v2.py    # Arquitectura BiGRU
    └── features_v2.py              # normalize + mirror + velocidades
```

## Uso rápido (standalone)

```python
from load_model_v2 import ModeloV2
import numpy as np

m = ModeloV2()
# Alimentar 30 frames (cada uno con 226 features de MediaPipe holistic)
for coords in stream_de_frames:
    m.add_frame(coords)
# Predecir
result = m.predict()
print(result["label"], result["confidence"])
```

## Integración con `model-ms`

Ver `lsc_engine_v2.py` y `v2_streaming_predictor.py` en el backend.

Generado: 2026-05-11 20:27:49
