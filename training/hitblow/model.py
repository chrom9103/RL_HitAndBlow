"""Q(s, a) を 1 つ出す小さな MLP。状態特徴と予想ごとの特徴を連結して入力する。"""
from __future__ import annotations

import torch
from torch import nn

from .features import N_INPUT

HIDDEN = (64, 64)


class QNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.l1 = nn.Linear(N_INPUT, HIDDEN[0])
        self.l2 = nn.Linear(HIDDEN[0], HIDDEN[1])
        self.l3 = nn.Linear(HIDDEN[1], 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.relu(self.l1(x))
        x = torch.relu(self.l2(x))
        return self.l3(x).squeeze(-1)

    def layers(self) -> list[nn.Linear]:
        return [self.l1, self.l2, self.l3]
