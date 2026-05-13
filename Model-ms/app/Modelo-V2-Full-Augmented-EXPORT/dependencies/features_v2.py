"""
Utilidades de feature engineering para el pipeline V2.

Layout esperado del vector de 226 elementos producido por HolisticDetector
con used_parts=["pose", "right_hand", "left_hand"]:

    [ pose (25 landmarks × 4 = 100) | right_hand (21 × 3 = 63) | left_hand (21 × 3 = 63) ]

- Pose incluye visibility (x, y, z, visibility).
- Las manos son solo (x, y, z).
"""
import numpy as np

POSE_COUNT = 25
POSE_DIMS = 4
HAND_COUNT = 21
HAND_DIMS = 3

POSE_SIZE = POSE_COUNT * POSE_DIMS         # 100
HAND_SIZE = HAND_COUNT * HAND_DIMS         # 63
TOTAL_SIZE = POSE_SIZE + 2 * HAND_SIZE     # 226

# Pose landmark indices (subset de 25, mismo orden que pose_info.py PoseLandmark)
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12

# Hand landmark indices (MediaPipe)
HAND_WRIST = 0
HAND_MIDDLE_MCP = 9

# Pares de pose que se intercambian al hacer mirror (izq ↔ der)
POSE_MIRROR_PAIRS = [
    (1, 4),   # LEFT_EYE_INNER  ↔ RIGHT_EYE_INNER
    (2, 5),   # LEFT_EYE        ↔ RIGHT_EYE
    (3, 6),   # LEFT_EYE_OUTER  ↔ RIGHT_EYE_OUTER
    (7, 8),   # LEFT_EAR        ↔ RIGHT_EAR
    (9, 10),  # MOUTH_LEFT      ↔ MOUTH_RIGHT
    (11, 12), # LEFT_SHOULDER   ↔ RIGHT_SHOULDER
    (13, 14), # LEFT_ELBOW      ↔ RIGHT_ELBOW
    (15, 16), # LEFT_WRIST      ↔ RIGHT_WRIST
    (17, 18), # LEFT_PINKY      ↔ RIGHT_PINKY
    (19, 20), # LEFT_INDEX      ↔ RIGHT_INDEX
    (21, 22), # LEFT_THUMB      ↔ RIGHT_THUMB
    (23, 24), # LEFT_HIP        ↔ RIGHT_HIP
]


def split_coords(coords: np.ndarray):
    """Divide un vector (226,) en (pose (25,4), right_hand (21,3), left_hand (21,3))."""
    if coords.shape[-1] != TOTAL_SIZE:
        raise ValueError(f"Se esperaba dim {TOTAL_SIZE}, se recibió {coords.shape[-1]}")
    pose = coords[..., :POSE_SIZE].reshape(POSE_COUNT, POSE_DIMS)
    right_hand = coords[..., POSE_SIZE:POSE_SIZE + HAND_SIZE].reshape(HAND_COUNT, HAND_DIMS)
    left_hand = coords[..., POSE_SIZE + HAND_SIZE:].reshape(HAND_COUNT, HAND_DIMS)
    return pose, right_hand, left_hand


def combine_coords(pose: np.ndarray, right_hand: np.ndarray, left_hand: np.ndarray) -> np.ndarray:
    """Reverso de split_coords: arma de vuelta el vector (226,)."""
    return np.concatenate([pose.flatten(), right_hand.flatten(), left_hand.flatten()])


def _normalize_hand(hand: np.ndarray) -> np.ndarray:
    """Centra la mano en la muñeca y escala por el tamaño de palma."""
    hand = hand.copy()
    if np.all(hand == 0):
        return hand  # mano ausente → ceros

    wrist = hand[HAND_WRIST].copy()
    scale = float(np.linalg.norm(hand[HAND_MIDDLE_MCP] - wrist))
    hand = hand - wrist
    if scale > 1e-6:
        hand = hand / scale
    return hand


def normalize_frame(coords: np.ndarray) -> np.ndarray:
    """Normaliza un frame (226,) respetando el layout pose/hand/hand.

    - Pose (solo x,y,z): centrada en mid-shoulders, escalada por ancho de hombros.
      El canal de visibility se conserva sin tocar.
    - Cada mano: centrada en wrist, escalada por wrist→middle_MCP.
    - Si alguna parte está ausente (todos ceros), se deja en ceros.
    """
    pose, right_hand, left_hand = split_coords(coords)

    # Normalizar pose (solo x,y,z; visibility intacto)
    pose = pose.copy()
    if not np.all(pose == 0):
        left_sh = pose[LEFT_SHOULDER, :3].copy()
        right_sh = pose[RIGHT_SHOULDER, :3].copy()
        center = (left_sh + right_sh) / 2.0
        scale = float(np.linalg.norm(left_sh - right_sh))

        pose[:, :3] = pose[:, :3] - center
        if scale > 1e-6:
            pose[:, :3] = pose[:, :3] / scale

    # Normalizar manos
    right_hand = _normalize_hand(right_hand)
    left_hand = _normalize_hand(left_hand)

    return combine_coords(pose, right_hand, left_hand)


def mirror_frame(coords: np.ndarray) -> np.ndarray:
    """Aplica mirror real: niega x, intercambia pares izq↔der de pose, intercambia manos."""
    pose, right_hand, left_hand = split_coords(coords)
    pose = pose.copy()
    right_hand = right_hand.copy()
    left_hand = left_hand.copy()

    # Negar x
    pose[:, 0] *= -1
    right_hand[:, 0] *= -1
    left_hand[:, 0] *= -1

    # Intercambiar pares de pose izq↔der
    for left_idx, right_idx in POSE_MIRROR_PAIRS:
        pose[[left_idx, right_idx]] = pose[[right_idx, left_idx]]

    # Intercambiar manos completas (la que era derecha ahora es izquierda y viceversa)
    right_hand, left_hand = left_hand, right_hand

    return combine_coords(pose, right_hand, left_hand)


def has_hand(coords: np.ndarray, threshold: float = 1e-3) -> bool:
    """True si alguna mano (derecha o izquierda) tiene landmarks no-cero."""
    right_hand = coords[POSE_SIZE:POSE_SIZE + HAND_SIZE]
    left_hand = coords[POSE_SIZE + HAND_SIZE:]
    return (
        float(np.abs(right_hand).sum()) > threshold
        or float(np.abs(left_hand).sum()) > threshold
    )


def add_velocity_features(sequence: np.ndarray) -> np.ndarray:
    """Dada una secuencia (T, 226), retorna (T, 452) agregando velocidades.

    Velocidad en t=0 es cero (no hay frame previo).
    """
    if sequence.ndim != 2:
        raise ValueError(f"Se esperaba (T, D), se recibió shape {sequence.shape}")

    velocity = np.zeros_like(sequence)
    velocity[1:] = sequence[1:] - sequence[:-1]
    return np.concatenate([sequence, velocity], axis=-1)
