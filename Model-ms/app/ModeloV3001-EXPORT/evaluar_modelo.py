#!/usr/bin/env python3
"""
Evaluador para el Modelo-COL-NUM-WORD-1101-2
Permite probar el modelo en tiempo real usando la cámara web o videos.
"""
import os
import sys
import cv2
import numpy as np
from load_model import ModeloLSC

# Agregar rutas relativas para importar módulos copiados
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(script_dir, 'utils'))
sys.path.insert(0, os.path.join(script_dir, 'models'))

# Importar detector holistic desde los utils copiados
try:
    from holistic.holistic_detector import HolisticDetector
except ImportError:
    # Intento alternativo de importación si la estructura interna de utils varía
    from utils.holistic.holistic_detector import HolisticDetector

class EvaluadorLSC:
    def __init__(self):
        print("🔧 Cargando Modelo LSC...")
        self.modelo = ModeloLSC()
        print("✅ Modelo listo para usar")
        
        # Inicializar detector Holistic
        self.holistic = HolisticDetector(
            static_mode=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1,
            use_hands=True,
            use_face=False, 
            use_pose=True,
        )
        print("✅ Detector Holistic inicializado")
        
        # Cargar clases del modelo para búsqueda rápida
        self.classes = []
        if hasattr(self.modelo, 'config') and 'classes' in self.modelo.config:
            for idx, label in self.modelo.config['classes'].items():
                self.classes.append((int(idx), label))
        
        print(f"✅ Clases cargadas: {len(self.classes)} señas")
    
    def evaluar_camara(self):
        """Evaluar usando cámara web"""
        print("\n" + "="*50)
        print("MODO CÁMARA EN VIVO")
        print("Presiona 'q' para salir.")
        print("="*50 + "\n")
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] No se pudo acceder a la cámara.")
            return
        
        cv2.namedWindow("Evaluación LSC", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Evaluación LSC", 800, 600)
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Detección holistic
                results = self.holistic.detect_holistic(frame)
                
                # Detectar manos activas
                mano_derecha_activa = results.right_hand_landmarks is not None
                mano_izquierda_activa = results.left_hand_landmarks is not None
                
                # Modo espejo inteligente para mano derecha sola
                if mano_derecha_activa and not mano_izquierda_activa:
                    frame = cv2.flip(frame, 1)
                    results = self.holistic.detect_holistic(frame)
                
                # Dibujar landmarks
                self.holistic.draw_prediction(frame, results)
                
                try:
                    # Extraer coordenadas usando el método propio del detector
                    # Nota: HolisticDetector suele tener get_coordenates o get_coordenadas
                    if hasattr(self.holistic, 'get_coordenates'):
                        coords = self.holistic.get_coordenates(results, used_parts=["pose", "right_hand", "left_hand"])
                    else:
                        coords = self.holistic.get_coordenadas(results, used_parts=["pose", "right_hand", "left_hand"])
                    
                    # Realizar predicción
                    pred_resultado = self.modelo.predict(coords)
                    
                    label = pred_resultado['label']
                    confidence = pred_resultado['confidence']
                    
                    if confidence > 0.4: # Umbral de visualización
                        color = (0, 255, 0)
                        cv2.rectangle(frame, (0,0), (640, 80), (245, 117, 16), -1)
                        cv2.putText(frame, f"Sena: {label}", (10,30), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
                        cv2.putText(frame, f"Confianza: {confidence:.1%}", (10,65), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

                except Exception as e:
                    # Errores comunes si no se detectan landmarks suficientes
                    pass

                cv2.imshow("Evaluación LSC", frame)
                
                if cv2.waitKey(10) & 0xFF == ord('q'):
                    break
        finally:
            cap.release()
            cv2.destroyAllWindows()

def main():
    print("="*60)
    print("   EVALUADOR LSC - MODELO EXPORTADO")
    print("="*60)
    
    evaluador = EvaluadorLSC()
    evaluador.evaluar_camara()

if __name__ == "__main__":
    main()
