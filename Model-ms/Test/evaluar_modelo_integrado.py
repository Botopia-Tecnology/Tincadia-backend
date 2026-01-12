#!/usr/bin/env python3
"""
Evaluador para el Modelo-ABC-1101 integrado con el repositorio
Usa la arquitectura actual del backend para pruebas completas
"""
import os
import sys
import cv2
import numpy as np
import json
import time
from collections import Counter

# Add the app directory to Python path and change to app directory
APP_DIR = os.path.join(os.path.dirname(__file__), '..', 'app')
sys.path.append(APP_DIR)
os.chdir(APP_DIR)  # Change working directory to app for model file access

# Importar desde el backend actual
from lsc_engine import LSCEngine
import mediapipe as mp

class EvaluadorIntegrado:
    def __init__(self):
        print("🔧 Inicializando evaluador con Modelo-ABC-1101...")
        
        # Cargar modelo usando el engine del backend
        self.predictor = LSCEngine.get_predictor()
        if not self.predictor:
            raise Exception("No se pudo cargar el predictor")
        
        print("✅ Modelo ABC-1101 cargado desde el backend")
        
        # Inicializar MediaPipe Holistic (igual que en el predictor)
        self.mp_holistic = mp.solutions.holistic
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("✅ Detector Holistic inicializado")
        
        # Obtener clases desde el modelo
        self.labels = LSCEngine.get_labels()
        self.classes = [(int(k), v) for k, v in self.labels.items()]
        print(f"✅ Clases cargadas: {len(self.classes)} señas")
    
    def _extract_coords(self, results) -> np.ndarray:
        """Extrae coordenadas en el formato exacto del modelo (226 valores)"""
        # 1. Pose (25 landmarks * 4: x, y, z, vis) -> 100 valores
        if results.pose_landmarks:
            pose = np.array([[lm.x, lm.y, lm.z, lm.visibility] for lm in results.pose_landmarks.landmark[:25]]).flatten()
        else:
            pose = np.zeros(100)
            
        # 2. Mano Derecha (21 * 3: x, y, z) -> 63 valores
        if results.right_hand_landmarks:
            rh = np.array([[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark]).flatten()
        else:
            rh = np.zeros(63)
            
        # 3. Mano Izquierda (21 * 3: x, y, z) -> 63 valores
        if results.left_hand_landmarks:
            lh = np.array([[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark]).flatten()
        else:
            lh = np.zeros(63)
            
        return np.concatenate([pose, rh, lh])
    
    def _normalize_landmarks(self, coords: np.ndarray) -> np.ndarray:
        """
        Aplica la misma normalización usada durante el entrenamiento del modelo ABC-1101:
        Normalización min-max al rango [0,1] para cada eje (x, y, z)
        """
        try:
            # 1. Descomponer coordenadas
            pose_coords = coords[:100].reshape(25, 4).copy()
            hands_coords = coords[100:].reshape(42, 3).copy()
            
            # Extraer solo x, y, z para normalización
            pose_xyz = pose_coords[:, :3]  # (25, 3)
            hands_xyz = hands_coords  # (42, 3)
            
            # 2. Normalización min-max para pose (solo puntos no cero)
            pose_mask = np.any(pose_xyz != 0, axis=1)
            if np.any(pose_mask):
                pose_valid = pose_xyz[pose_mask]
                pose_min = pose_valid.min(axis=0)
                pose_max = pose_valid.max(axis=0)
                pose_range = pose_max - pose_min
                
                # Evitar división por cero
                pose_range[pose_range == 0] = 1
                
                # Normalizar solo puntos válidos
                pose_xyz[pose_mask] = (pose_xyz[pose_mask] - pose_min) / pose_range
            
            # 3. Normalización min-max para manos (solo puntos no cero)
            hands_mask = np.any(hands_xyz != 0, axis=1)
            if np.any(hands_mask):
                hands_valid = hands_xyz[hands_mask]
                hands_min = hands_valid.min(axis=0)
                hands_max = hands_valid.max(axis=0)
                hands_range = hands_max - hands_min
                
                # Evitar división por cero
                hands_range[hands_range == 0] = 1
                
                # Normalizar solo puntos válidos
                hands_xyz[hands_mask] = (hands_xyz[hands_mask] - hands_min) / hands_range
            
            # 4. Recomponer con visibility intacta
            pose_coords[:, :3] = pose_xyz
            hands_coords[:, :] = hands_xyz
            
            return np.concatenate([pose_coords.flatten(), hands_coords.flatten()])
            
        except Exception as e:
            print(f"[ERROR] Normalización falló: {e}")
            return coords
    
    def evaluar_camara(self):
        """Evaluar usando cámara web - integrado con backend"""
        print("\n" + "="*60)
        print("MODO CÁMARA EN VIVO - MODELO ABC-1101 INTEGRADO")
        print("Presiona 'q' para salir, 's' para capturar estática")
        print("="*60 + "\n")
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] No se pudo acceder a la cámara.")
            return
        
        cv2.namedWindow("Evaluación LSC - ABC-1101", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Evaluación LSC - ABC-1101", 1000, 700)
        
        frame_count = 0
        predicciones_recientes = []
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_count += 1
                
                # Convertir a RGB para MediaPipe
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.holistic.process(image_rgb)
                
                # Detectar manos activas
                mano_derecha_activa = results.right_hand_landmarks is not None
                mano_izquierda_activa = results.left_hand_landmarks is not None
                
                # Modo espejo para mano derecha
                if mano_derecha_activa and not mano_izquierda_activa:
                    frame_display = cv2.flip(frame, 1)
                    # Re-procesar después del flip
                    image_rgb = cv2.cvtColor(frame_display, cv2.COLOR_BGR2RGB)
                    results = self.holistic.process(image_rgb)
                else:
                    frame_display = frame.copy()
                
                # Dibujar landmarks
                self._draw_landmarks(frame_display, results)
                
                # Mostrar información de manos
                mano_texto = "Manos detectadas: "
                if mano_derecha_activa and mano_izquierda_activa:
                    mano_texto += "Ambas"
                elif mano_derecha_activa:
                    mano_texto += "Derecha (Modo Espejo)"
                elif mano_izquierda_activa:
                    mano_texto += "Izquierda"
                else:
                    mano_texto += "Ninguna"
                
                cv2.putText(frame_display, mano_texto, (10, 30), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA)
                
                # Realizar predicción si hay landmarks
                prediction_result = None
                if results.pose_landmarks or results.right_hand_landmarks or results.left_hand_landmarks:
                    try:
                        coords = self._extract_coords(results)
                        norm_coords = self._normalize_landmarks(coords)
                        
                        # DEBUG: Comparar coordenadas
                        print(f"[EVALUADOR] Coords originales (primeras 10): {coords[:10]}")
                        print(f"[EVALUADOR] Coords normalizadas (primeras 10): {norm_coords[:10]}")
                        
                        # Usar el predictor del backend
                        result = self.predictor.predict_from_coords(norm_coords.tolist())
                        prediction_result = result
                        
                        if result['word'] and result['confidence'] > 0.3:
                            predicciones_recientes.append(result['word'])
                            
                            # Mantener solo últimas 10 predicciones para suavizado
                            if len(predicciones_recientes) > 10:
                                predicciones_recientes.pop(0)
                            
                            # Suavizado con voto mayoritario
                            if len(predicciones_recientes) >= 3:
                                counter = Counter(predicciones_recientes)
                                most_common = counter.most_common(1)[0]
                                
                                if most_common[1] >= 2:  # Aparece al menos 2 veces
                                    prediction_text = most_common[0]
                                    confidence_text = f"{result['confidence']*100:.1f}%"
                                    
                                    # Dibujar resultado
                                    cv2.rectangle(frame_display, (0, 60), (600, 140), (245, 117, 16), -1)
                                    cv2.putText(frame_display, f"Seña: {prediction_text}", (10, 90), 
                                                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
                                    cv2.putText(frame_display, f"Confianza: {confidence_text}", (10, 125), 
                                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
                                    
                                    # Debug para Ñ
                                    if "Ñ" in prediction_text:
                                        print(f"[DEBUG] Ñ detectada - Confianza: {result['confidence']*100:.1f}%")
                    
                    except Exception as e:
                        print(f"[ERROR] Predicción: {e}")
                
                # Mostrar información del frame
                cv2.putText(frame_display, f"Frame: {frame_count}", (10, 470), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
                if prediction_result:
                    cv2.putText(frame_display, f"Status: {prediction_result['status']}", (10, 490), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
                cv2.imshow("Evaluación LSC - ABC-1101", frame_display)
                
                key = cv2.waitKey(10) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('s'):
                    # Capturar estática
                    timestamp = int(time.time())
                    filename = f"captura_{timestamp}.jpg"
                    cv2.imwrite(filename, frame_display)
                    print(f"📸 Captura guardada: {filename}")
                    
        finally:
            cap.release()
            cv2.destroyAllWindows()
    
    def evaluar_video(self, video_path):
        """Evaluar un video específico usando el backend"""
        if not os.path.exists(video_path):
            print(f"[ERROR] Video no encontrado: {video_path}")
            return
        
        print(f"📹 Procesando video: {os.path.basename(video_path)}")
        
        # Usar el predictor del backend directamente
        resultado = self.predictor.predict_video(video_path)
        
        print("="*60)
        print("   EVALUADOR MODELO-ABC-1101 (INTEGRADO)")
        print("="*60)
        
        if resultado:
            print(f"✅ Video: {os.path.basename(video_path)}")
            print(f"   Predicción: {resultado}")
        else:
            print(f"❌ No se pudieron obtener predicciones del video")
    
    def evaluar_streaming_simulado(self):
        """Simular streaming como lo haría el frontend"""
        print("\n" + "="*60)
        print("MODO STREAMING SIMULADO (COMO FRONTEND)")
        print("Presiona 'q' para salir")
        print("="*60 + "\n")
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] No se pudo acceder a la cámara.")
            return
        
        # Importar predictor de streaming
        from lsc_streaming_exacto import LSCStreamingPredictor
        from lsc_engine import LSCEngine
        
        # Obtener modelo y etiquetas compartidos
        model, labels = LSCEngine.get_model_and_labels()
        
        # Crear predictor de streaming
        streaming_predictor = LSCStreamingPredictor(
            "weights.hdf5", "model_config.json", "lsc_labels.json",
            buffer_size=30,
            shared_model=model,
            shared_labels=labels
        )
        
        cv2.namedWindow("Streaming Simulado", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Streaming Simulado", 800, 600)
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Convertir a RGB para MediaPipe
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.holistic.process(image_rgb)
                
                # Dibujar landmarks
                self._draw_landmarks(frame, results)
                
                # Simular envío de landmarks al streaming predictor
                if results.pose_landmarks or results.right_hand_landmarks or results.left_hand_landmarks:
                    try:
                        coords = self._extract_coords(results)
                        norm_coords = self._normalize_landmarks(coords)
                        
                        # Usar predictor de streaming (como lo hace el frontend)
                        result = streaming_predictor.add_landmarks(norm_coords)
                        
                        if result['word']:
                            cv2.rectangle(frame, (0, 0), (400, 80), (245, 117, 16), -1)
                            cv2.putText(frame, f"Streaming: {result['word']}", (10, 30), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
                            cv2.putText(frame, f"Buffer: {result['buffer_fill']:.1%}", (10, 60), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
                    
                    except Exception as e:
                        print(f"[ERROR] Streaming: {e}")
                
                cv2.imshow("Streaming Simulado", frame)
                
                if cv2.waitKey(10) & 0xFF == ord('q'):
                    break
                    
        finally:
            cap.release()
            cv2.destroyAllWindows()
    
    def _draw_landmarks(self, frame, results):
        """Dibuja los landmarks de MediaPipe"""
        # Dibujar pose
        if results.pose_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                frame, results.pose_landmarks, mp.solutions.holistic.POSE_CONNECTIONS,
                mp.solutions.drawing_styles.DrawingSpec(color=(80,22,10), thickness=2, circle_radius=4),
                mp.solutions.drawing_styles.DrawingSpec(color=(80,44,121), thickness=2, circle_radius=2)
            )
        
        # Dibujar manos
        if results.left_hand_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                frame, results.left_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS,
                mp.solutions.drawing_styles.DrawingSpec(color=(121,22,76), thickness=2, circle_radius=4),
                mp.solutions.drawing_styles.DrawingSpec(color=(121,44,250), thickness=2, circle_radius=2)
            )
        
        if results.right_hand_landmarks:
            mp.solutions.drawing_utils.draw_landmarks(
                frame, results.right_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS,
                mp.solutions.drawing_styles.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=4),
                mp.solutions.drawing_styles.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            )

def main():
    print("="*60)
    print("   EVALUADOR MODELO-ABC-1101 (INTEGRADO)")
    print("   Usando arquitectura del backend actual")
    print("="*60)
    
    try:
        evaluador = EvaluadorIntegrado()
        
        while True:
            print("\n🎯 OPCIONES DE EVALUACIÓN:")
            print("1. Cámara Web (Predicción Directa)")
            print("2. Cámara Web (Streaming Simulado)")
            print("3. Evaluar Video Específico")
            print("4. Probar API Gateway (Endpoints)")
            print("5. Salir")
            
            opcion = input("\nSelecciona una opción (1-5): ").strip()
            
            if opcion == '1':
                evaluador.evaluar_camara()
            elif opcion == '2':
                evaluador.evaluar_streaming_simulado()
            elif opcion == '3':
                video_path = input("Ingresa la ruta del video: ").strip().replace('"', '')
                evaluador.evaluar_video(video_path)
            elif opcion == '4':
                print("\n🌐 Para probar la API Gateway:")
                print("1. Ejecuta: python main.py")
                print("2. Abre: http://localhost:8000/docs")
                print("3. Prueba los endpoints:")
                print("   - POST /predict (subir video)")
                print("   - POST /predict/landmarks (coordenadas)")
                print("   - POST /predict/audio (video + audio)")
                print("   - WebSocket: ws://localhost:8000 (streaming)")
                input("\nPresiona Enter para continuar...")
            elif opcion == '5':
                print("Saliendo...")
                break
            else:
                print("Opción no válida.")
                
    except Exception as e:
        print(f"❌ Error al inicializar: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
