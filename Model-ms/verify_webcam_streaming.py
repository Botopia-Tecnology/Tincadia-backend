
import cv2
import numpy as np
import sys
import os

# Configurar rutas relativas al archivo para importar 'app'
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(base_dir, "app"))
sys.path.insert(0, os.path.join(base_dir, "app", "ModeloV3001-EXPORT"))

from lsc_streaming_exacto import LSCStreamingPredictor
from lsc_engine import LSCEngine
from utils.holistic.holistic_detector import HolisticDetector

def main():
    print("\n" + "="*50)
    print("🎥 VERIFICADOR DE STREAMING LSC (CÁMARA LOCAL)")
    print("Simula exactamente el comportamiento del servidor de producción.")
    print("="*50 + "\n")
    
    # 1. Cargar el predictor base (ModeloV3001)
    print("📦 Cargando modelo y recursos...")
    base_predictor = LSCEngine.get_predictor()
    if not base_predictor:
        print("❌ Error: No se pudo cargar el modelo. Verifica que app/ModeloV3001-EXPORT esté completo.")
        return

    # 2. Inicializar el predictor de STREAMING 
    # (Este tiene la lógica de dual-prediction, smoothing y normalización Min-Max corregida)
    streaming_predictor = LSCStreamingPredictor(base_predictor=base_predictor)
    
    # 3. Inicializar el detector Holistic de MediaPipe (Sincronizado con evaluar_modelo.py)
    detector = HolisticDetector(use_face=False, model_complexity=1)
    
    # 4. Iniciar cámara
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Error: No se pudo acceder a la cámara web.")
        return

    print("✅ Sistema cargado. Iniciando ventana visual...")
    print("💡 TIP: Prueba con ambas manos y fíjate en el log 'Mirror-Match' o 'Standard-Match'.")
    print("Presiona 'q' para salir.")

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # Espejar visualmente para que el usuario se vea como en un espejo (comodidad)
            display_frame = cv2.flip(frame, 1)
            
            # Detección (usamos el frame original sin espejar para probar la robustez del predictor)
            results = detector.detect_holistic(frame)
            
            # Dibujar landmarks en el frame de visualización
            detector.draw_prediction(display_frame, results)
            
            try:
                # Extraer coordenadas de 226 dimensiones
                coords = detector.get_coordenates(results, used_parts=["pose", "right_hand", "left_hand"])
                
                # Procesar con el motor de streaming
                res = streaming_predictor.add_landmarks(coords)
                
                # Info de predicción
                conf = res.get('confidence', 0)
                word = res.get('word')
                status = res.get('status')
                dist_alert = res.get('distance_alert')
                
                # Visualización
                color = (0, 255, 0) if conf > 0.4 else (0, 0, 255)
                
                # Barra de estado
                cv2.rectangle(display_frame, (0,0), (800, 130), (0,0,0), -1)
                
                cv2.putText(display_frame, f"SENA: {word if word else '---'}", (20, 45), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
                cv2.putText(display_frame, f"CONFIANZA: {conf:.2%}", (20, 90), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                
                # Tags laterales
                cv2.putText(display_frame, f"Estado: {status}", (400, 45), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.putText(display_frame, f"Dist: {dist_alert}", (400, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                
                # Si hay buffer lleno, mostrar indicador
                fill = res.get('buffer_fill', 0)
                cv2.rectangle(display_frame, (400, 100), (400 + int(fill * 200), 115), (255, 165, 0), -1)

            except Exception as e:
                pass

            cv2.imshow("Verificador Streaming LSC", display_frame)
            if cv2.waitKey(5) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        print("\n🧼 Limpiando recursos...")
        cap.release()
        cv2.destroyAllWindows()
        print("👋 ¡Prueba terminada!")

if __name__ == "__main__":
    main()
