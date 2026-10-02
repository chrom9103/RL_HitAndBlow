"""プレイヤー向けヒントのミニマックス法(app/src/hint/minimax.ts と同じ選び方)。

考えられるすべての予想(候補以外も含む 5,040 通り)について、返ってくる判定ごとに候補を分け、
一番大きいグループが最小になる予想を選ぶ。同じなら候補に含まれる予想、それでも同じなら
グループの大きさの二乗和が小さい予想、最後はインデックスの小さい予想。
"""
from __future__ import annotations

import numpy as np

from .codes import MAX_TURNS, N_CODES, N_FEEDBACK, WIN_FEEDBACK, feedback_table


def best_guess(cands: np.ndarray) -> int:
    """cands(昇順のインデックス、空でない)に対するミニマックス法の予想。"""
    m = len(cands)
    if m == 0:
        raise ValueError("候補がありません")
    if m <= 2:
        return int(cands[0])
    if m == N_CODES:
        # 1 手目: 対称性により、どの予想も同じ分かれ方になる
        return 0
    fb = feedback_table()
    # counts[g, r] = 予想 g で判定 r になる候補の数
    idx = fb[:, cands].astype(np.int64) + (np.arange(N_CODES, dtype=np.int64) * N_FEEDBACK)[:, None]
    counts = np.bincount(idx.ravel(), minlength=N_CODES * N_FEEDBACK).reshape(N_CODES, N_FEEDBACK)
    max_group = counts.max(axis=1)
    sum_sq = (counts * counts).sum(axis=1)
    in_c = np.zeros(N_CODES, dtype=np.int64)
    in_c[cands] = 1
    # np.lexsort は最後のキーが最優先
    order = np.lexsort((np.arange(N_CODES), sum_sq, -in_c, max_group))
    return int(order[0])


def play_minimax(secret: int) -> list[int]:
    """ヒントどおりに打ったときの予想の列(最後が正解なら当てた)。"""
    fb = feedback_table()
    cands = np.arange(N_CODES)
    guessed: list[int] = []
    for _ in range(MAX_TURNS):
        g = best_guess(cands)
        guessed.append(g)
        r = fb[g, secret]
        if r == WIN_FEEDBACK:
            break
        cands = cands[fb[g, cands] == r]
    return guessed


def minimax_turns_all() -> np.ndarray:
    """秘密の数字 5,040 通りそれぞれについて、当てるまでの回数。

    同じ局面では同じ予想になるので、判定ごとに候補を分けて木をたどる(1 ゲームずつ打つより速い)。
    """
    fb = feedback_table()
    turns = np.zeros(N_CODES, dtype=np.int64)

    def walk(cands: np.ndarray, depth: int) -> None:
        g = best_guess(cands)
        r = fb[g, cands]
        for value in np.unique(r):
            part = cands[r == value]
            if value == WIN_FEEDBACK:
                turns[part] = depth
            else:
                walk(part, depth + 1)

    walk(np.arange(N_CODES), 1)
    return turns
