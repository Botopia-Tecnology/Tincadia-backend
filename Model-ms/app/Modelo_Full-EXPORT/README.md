# Modelo_Full - Reconocimiento LSC

## 📊 Información del Modelo
- **Nombre:** Modelo_Full
- **Precisión:** 55.79%
- **Pérdida:** 1.8881
- **Clases:** 160
- **Arquitectura:** get_model_coord_dense_5
- **Input Shape:** (226,)
- **Fecha:** {TinyDate}:2026-08-04T13:05:28.314019

## 📁 Archivos Incluidos
- `weights.hdf5` — pesos entrenados
- `model_config.json` — configuración y metadatos
- `load_model.py` — cargador listo para usar
- `dependencies/coordenates_models.py` — arquitectura de la red
- `requirements.txt`

## 🚀 Uso Rápido
```python
from load_model import ModeloLSC
modelo = ModeloLSC()
resultado = modelo.predict(coordinates_array)  # array de 226 valores
print(resultado['label'], resultado['confidence'])
```

## 📋 Requisitos
```bash
pip install -r requirements.txt
```

## 🎯 Clases Disponibles
- Abuela
- Abuelo
- Aburrida
- Aburrido
- Amarillo
- Amor
- Apellido
- Aprender
- Ayudar
- Azul
- Banco
- Bien
- Bienvenido 
- Blanco 
- Bonita
- Buenas tardes 
- Buenas-noches
- Buenos días
- COMO-ESTA
- CON-GUSTO
- CUATRO
- Café
- Cansado
- Cansona
- Celular
- Chao
- Cinco
- Cine
- Comer
- Comida
- Como
- Comprar 
- Contento
- Cuando
- Cuanto
- De-nada
- Descansar 
- Diez
- Diferente
- Dificil
- Dinero
- Donde
- Dormir
- Dos
- Empresa
- Enamorar 
- Esposa
- Esposo
- Facil
- Familia
- Feliz
- Feo
- Futbol
- Gracias
- Grande
- Gris
- Grosero
- Gustar 
- Hambre F.1
- Helado
- Hermana
- Hermano
- Hermosa
- Hija
- Hijo
- Hola
- Hombre
- Hospital
- Jugar
- Juicioso
- LLuvia
- Letra_A
- Letra_B
- Letra_C
- Letra_D
- Letra_E
- Letra_F
- Letra_G
- Letra_H
- Letra_I
- Letra_J
- Letra_K
- Letra_L
- Letra_M
- Letra_N
- Letra_O
- Letra_P
- Letra_Q
- Letra_R
- Letra_S
- Letra_T
- Letra_U
- Letra_V
- Letra_W
- Letra_X
- Letra_Y
- Letra_Z
- Letra_Ñ
- Llorar
- MAS_O_MENOS
- Mal
- Mamá
- Mediano
- Mia
- Mio
- Molestar
- Morado
- Mucho
- Mujer
- Naranja
- Negro
- Nequi
- Niña
- Niño
- Nombre
- Novia
- Novio
- Nueve
- Numero
- Nunca
- Ocho
- PERMISO
- Pagar
- Papá
- Parque
- Pelear
- Pequeño
- Perdon
- Personas
- Poco
- Por-favor
- Por-que
- Prima 
- Primo
- Querer
- Quien
- Quiz
- Respeto
- Rojo
- Rosado
- Salud
- Seis
- Sentir
- Seña
- Siete
- Tia
- Tio
- Todos F.1
- Trabajar
- Tres
- Triste
- Tu
- Universidad
- Uno
- Urgente
- Ustedes
- Vamos
- Verde
- Vivir
- Yo

---
Generado: 2026-08-04 13:10:36
