"""重みから予想を選ぶ参照実装(numpy float64)。app/src/cpu/policy.ts と同じ手順。

- 重みは配布形式と同じ float32 に丸めたものを使い、計算は float64 で行う。
- すでに予想した数字は選ばない。
- 最大 Q との差が TIE_EPS 以内の予想は同点とみなし、最小インデックスを選ぶ
  (アプリでは同点の中からランダムに選ぶ)。
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .codes import N_CODES
from .features import action_features, state_features

TIE_EPS = 1e-9


@dataclass
class Weights:
    """layers[i] = (W: (out, in), b: (out,))"""

    layers: list[tuple[np.ndarray, np.ndarray]]

    @staticmethod
    def from_flat(flat: np.ndarray, sizes: list[int]) -> "Weights":
        layers = []
        off = 0
        for n_in, n_out in zip(sizes[:-1], sizes[1:]):
            w = flat[off : off + n_in * n_out].reshape(n_out, n_in).astype(np.float64)
            off += n_in * n_out
            b = flat[off : off + n_out].astype(np.float64)
            off += n_out
            layers.append((w, b))
        assert off == len(flat)
        return Weights(layers)


def forward(weights: Weights, x: np.ndarray) -> np.ndarray:
    h = x
    for i, (w, b) in enumerate(weights.layers):
        h = h @ w.T + b
        if i < len(weights.layers) - 1:
            h = np.maximum(h, 0.0)
    return h[:, 0]


def build_inputs(cands: np.ndarray, turn: int, act: np.ndarray | None = None) -> np.ndarray:
    s = state_features(cands, turn)
    a = action_features(cands) if act is None else act
    return np.concatenate([np.broadcast_to(s, (N_CODES, len(s))), a], axis=1)


def q_values(weights: Weights, cands: np.ndarray, turn: int) -> np.ndarray:
    return forward(weights, build_inputs(cands, turn))


def select(q: np.ndarray, guessed: list[int]) -> int:
    q = q.copy()
    q[guessed] = -np.inf
    best = q.max()
    return int(np.flatnonzero(q >= best - TIE_EPS)[0])
