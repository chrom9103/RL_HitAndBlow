"""5,040 通りの数字列と、Hit/Blow 判定表。

コードは itertools.permutations(range(10), 4) の辞書順に並べ、アプリ側(TypeScript)の
ALL_CODES と同じインデックスを使う。
"""
from __future__ import annotations

import itertools

import numpy as np

N_CODES = 5040
MAX_TURNS = 10
N_FEEDBACK = 25  # hit * 5 + blow(実際に現れるのは 14 種)
WIN_FEEDBACK = 4 * 5 + 0

CODES = np.array(list(itertools.permutations(range(10), 4)), dtype=np.int8)
assert CODES.shape == (N_CODES, 4)


def code_str(i: int) -> str:
    return "".join(str(d) for d in CODES[i])


def code_index(s: str) -> int:
    digits = [int(ch) for ch in s]
    # 辞書順の位置を直接計算する
    idx = 0
    used: list[int] = []
    for pos, d in enumerate(digits):
        smaller = sum(1 for x in range(d) if x not in used)
        remaining = 9 - pos
        perms = 1
        for k in range(3 - pos):
            perms *= remaining - k
        idx += smaller * perms
        used.append(d)
    return idx


def judge(secret: str, guess: str) -> tuple[int, int]:
    hit = sum(a == b for a, b in zip(secret, guess))
    common = len(set(secret) & set(guess))
    return hit, common - hit


def build_feedback_table() -> np.ndarray:
    """fb[g, s] = hit*5 + blow(予想 g・秘密 s)。5040x5040 uint8(約25MB)。"""
    onehot = np.zeros((N_CODES, 10), dtype=np.int16)
    onehot[np.arange(N_CODES)[:, None], CODES] = 1
    common = onehot @ onehot.T
    hit = np.zeros((N_CODES, N_CODES), dtype=np.int16)
    for p in range(4):
        hit += CODES[:, p][:, None] == CODES[:, p][None, :]
    return (hit * 5 + (common - hit)).astype(np.uint8)


_FB: np.ndarray | None = None


def feedback_table() -> np.ndarray:
    global _FB
    if _FB is None:
        _FB = build_feedback_table()
    return _FB
