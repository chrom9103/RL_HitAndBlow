"""候補集合から特徴量を作る。アプリ側 app/src/cpu/features.ts と同じ定義。

状態特徴(43):
  0   log2|C| / log2 5040
  1   手数 / 10
  2   |C| == 1
  3.. 桁 p ごとの数字 d の出現割合(p 優先で 4x10)
行動特徴(8, 予想 g ごと):
  0   g が候補に含まれる
  1   g で即正解する確率(含まれれば 1/|C|)
  2   期待残り候補率 Σ n_r² / |C|²
  3   判定分布のエントロピー / log2 14
  4   最大バケット率 max n_r / |C|
  5   空でないバケット数 / 14
  6   桁頻度スコア(4 桁の出現割合の平均)
  7   期待 log 残り候補数 Σ (n_r/|C|) log2 n_r / log2 5040
"""
from __future__ import annotations

import math

import numpy as np

from .codes import CODES, N_CODES, N_FEEDBACK, feedback_table

N_STATE = 43
N_ACTION = 8
N_INPUT = N_STATE + N_ACTION
LOG2_N = math.log2(N_CODES)
LOG2_14 = math.log2(14)


def state_features(cands: np.ndarray, turn: int) -> np.ndarray:
    m = len(cands)
    s = np.zeros(N_STATE, dtype=np.float64)
    s[0] = math.log2(m) / LOG2_N
    s[1] = turn / 10
    s[2] = 1.0 if m == 1 else 0.0
    s[3:] = pos_freq(cands).ravel()
    return s


def pos_freq(cands: np.ndarray) -> np.ndarray:
    m = len(cands)
    freq = np.zeros((4, 10), dtype=np.float64)
    digits = CODES[cands]
    for p in range(4):
        freq[p] = np.bincount(digits[:, p], minlength=10) / m
    return freq


def action_features(cands: np.ndarray) -> np.ndarray:
    """全 5,040 予想の行動特徴 (5040, 8)。"""
    fb = feedback_table()
    m = len(cands)
    sub = fb[:, cands].astype(np.int64)
    sub += (np.arange(N_CODES, dtype=np.int64) * N_FEEDBACK)[:, None]
    counts = np.bincount(sub.ravel(), minlength=N_CODES * N_FEEDBACK).reshape(N_CODES, N_FEEDBACK)
    counts = counts.astype(np.float64)
    return _action_features_from_counts(counts, cands)


def _action_features_from_counts(counts: np.ndarray, cands: np.ndarray) -> np.ndarray:
    m = len(cands)
    p = counts / m
    a = np.zeros((counts.shape[0], N_ACTION), dtype=np.float64)
    in_c = np.zeros(N_CODES, dtype=np.float64)
    in_c[cands] = 1.0
    a[:, 0] = in_c[: counts.shape[0]]
    a[:, 1] = a[:, 0] / m
    a[:, 2] = _rowsum(p * p)
    with np.errstate(divide="ignore", invalid="ignore"):
        plogp = np.where(counts > 0, p * np.log2(np.where(counts > 0, p, 1.0)), 0.0)
        plogn = np.where(counts > 0, p * np.log2(np.where(counts > 0, counts, 1.0)), 0.0)
    a[:, 3] = -_rowsum(plogp) / LOG2_14
    a[:, 4] = counts.max(axis=1) / m
    a[:, 5] = (counts > 0).sum(axis=1) / 14
    freq = pos_freq(cands)
    a[:, 6] = (freq[0, CODES[:, 0]] + freq[1, CODES[:, 1]] + freq[2, CODES[:, 2]] + freq[3, CODES[:, 3]]) / 4
    a[:, 7] = _rowsum(plogn) / LOG2_N
    return a


def _rowsum(x: np.ndarray) -> np.ndarray:
    """左から順に足す(TypeScript 側と同じ加算順にして誤差をそろえる)。"""
    out = np.zeros(x.shape[0], dtype=np.float64)
    for r in range(x.shape[1]):
        out += x[:, r]
    return out
