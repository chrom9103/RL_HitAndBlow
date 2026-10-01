"""学習済みの重みや基準戦略で 1 ゲームを最後まで打つ。"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from .codes import MAX_TURNS, N_CODES, WIN_FEEDBACK, feedback_table
from .features import action_features, state_features
from .model import QNet
from .policy import Weights, forward, select

FAIL_TURNS = MAX_TURNS + 1  # 10 回で当てられなかったときに数える回数


def flat_weights(net: QNet) -> np.ndarray:
    """配布形式(層ごとに W (out, in) → b、float32)に並べた 1 次元配列。"""
    parts = []
    for layer in net.layers():
        parts.append(layer.weight.detach().numpy().astype(np.float32).ravel())
        parts.append(layer.bias.detach().numpy().astype(np.float32).ravel())
    return np.concatenate(parts)


def layer_sizes(net: QNet) -> list[int]:
    ls = net.layers()
    return [ls[0].in_features] + [layer.out_features for layer in ls]


def load_weights(path: str | Path) -> Weights:
    net = QNet()
    net.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
    return Weights.from_flat(flat_weights(net), layer_sizes(net))


class FeatureMemo:
    """同じ候補集合の特徴を使い回す(評価の高速化用)。"""

    def __init__(self, max_entries: int = 20000):
        self.data: dict[bytes, tuple[np.ndarray, np.ndarray]] = {}
        self.max_entries = max_entries

    def inputs(self, cands: np.ndarray, turn: int) -> np.ndarray:
        key = cands.tobytes()
        hit = self.data.get(key)
        if hit is None:
            hit = (state_features(cands, 0), action_features(cands))
            if len(self.data) < self.max_entries:
                self.data[key] = hit
        s, a = hit
        s = s.copy()
        s[1] = turn / 10
        return np.concatenate([np.broadcast_to(s, (N_CODES, len(s))), a], axis=1)


def play_agent(weights: Weights, secret: int, memo: FeatureMemo | None = None) -> list[int]:
    """エージェントの予想の列を返す(最後が正解なら当てた)。"""
    fb = feedback_table()
    memo = memo or FeatureMemo()
    cands = np.arange(N_CODES)
    guessed: list[int] = []
    for turn in range(MAX_TURNS):
        q = forward(weights, memo.inputs(cands, turn))
        g = select(q, guessed)
        guessed.append(g)
        r = fb[g, secret]
        if r == WIN_FEEDBACK:
            break
        cands = cands[fb[g, cands] == r]
    return guessed


def play_baseline(secret: int, rng: np.random.Generator) -> list[int]:
    """基準プレイヤー: 矛盾しない候補からランダムに選ぶ。"""
    fb = feedback_table()
    cands = np.arange(N_CODES)
    guessed: list[int] = []
    for _ in range(MAX_TURNS):
        g = int(rng.choice(cands))
        guessed.append(g)
        r = fb[g, secret]
        if r == WIN_FEEDBACK:
            break
        cands = cands[fb[g, cands] == r]
    return guessed


def turns_to_solve(guesses: list[int], secret: int) -> int:
    return len(guesses) if guesses and guesses[-1] == secret else FAIL_TURNS
