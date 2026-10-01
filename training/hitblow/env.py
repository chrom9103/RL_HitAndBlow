"""1 エピソード = 1 つの秘密の数字を当てるまで(上限 10 手)。"""
from __future__ import annotations

import numpy as np

from .codes import MAX_TURNS, N_CODES, WIN_FEEDBACK, feedback_table

STEP_REWARD = -1.0
FAIL_PENALTY = -5.0


def solve_bonus(turn: int) -> float:
    """turn 手目(1..10)で当てたときのボーナス。早いほど大きい。"""
    return float(MAX_TURNS + 1 - turn)


class HitBlowEnv:
    def __init__(self, secret: int):
        self.secret = secret
        self.fb = feedback_table()
        self.cands = np.arange(N_CODES)
        self.turn = 0  # これまでに予想した回数
        self.guessed: list[int] = []
        self.done = False

    def step(self, guess: int) -> tuple[float, bool, int]:
        assert not self.done
        self.turn += 1
        self.guessed.append(guess)
        r = int(self.fb[guess, self.secret])
        self.cands = self.cands[self.fb[guess, self.cands] == r]
        reward = STEP_REWARD
        if r == WIN_FEEDBACK:
            reward += solve_bonus(self.turn)
            self.done = True
        elif self.turn >= MAX_TURNS:
            reward += FAIL_PENALTY
            self.done = True
        return reward, self.done, r
