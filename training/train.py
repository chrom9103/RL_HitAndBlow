"""Hit & Blow の CPU を DQN で学習する。

    python train.py                     # 既定の設定(シード 0)で学習
    python train.py --episodes 2000     # 短く試す

1 回の学習ランの途中で --save-at のエピソード数ごとにチェックポイントを保存する。
難易度(Easy / Normal / Hard)には、このうち 3 つを割り当てる(difficulties.json)。

DQN の構成:
  - Q(s, a) を 1 値で出す MLP を全 5,040 予想に適用し、最大のものを選ぶ
  - 経験再生バッファ、ターゲットネットワーク(定期的に同期)、ε-greedy
  - Double DQN: 次状態の行動はオンラインネットで選び、ターゲットネットで評価する
    (次状態は、遷移時点のオンライン Q 上位 K 個の予想の特徴だけを保存して近似する)
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from hitblow.codes import MAX_TURNS, N_CODES, WIN_FEEDBACK
from hitblow.env import HitBlowEnv
from hitblow.features import N_ACTION, N_INPUT, N_STATE, action_features, state_features
from hitblow.model import QNet

DEFAULT_SAVE_AT = "100,200,300,400,500,750,1000,1500,2000,3000,4000,5000,7500,10000,15000,20000,25000,30000,40000"


class FeatureCache:
    """候補集合が大きい局面(主に 1〜2 手目)の特徴をキャッシュする。"""

    def __init__(self, min_size: int = 150, max_entries: int = 4000):
        self.min_size = min_size
        self.max_entries = max_entries
        self.data: dict[bytes, tuple[np.ndarray, np.ndarray]] = {}

    def get(self, cands: np.ndarray, turn: int) -> tuple[np.ndarray, np.ndarray]:
        key = cands.tobytes() if len(cands) >= self.min_size else None
        if key is not None and key in self.data:
            s, a = self.data[key]
        else:
            s = state_features(cands, 0).astype(np.float32)
            a = action_features(cands).astype(np.float32)
            if key is not None:
                if len(self.data) >= self.max_entries:
                    self.data.pop(next(iter(self.data)))
                self.data[key] = (s, a)
        s = s.copy()
        s[1] = turn / 10
        return s, a


class Replay:
    def __init__(self, cap: int, k: int):
        self.cap, self.k = cap, k
        self.x = np.zeros((cap, N_INPUT), np.float32)
        self.r = np.zeros(cap, np.float32)
        self.d = np.zeros(cap, np.float32)
        self.ns = np.zeros((cap, N_STATE), np.float32)
        self.na = np.zeros((cap, k, N_ACTION), np.float32)
        self.n = 0
        self.pos = 0

    def add(self, x, r, d, ns=None, na=None):
        i = self.pos
        self.x[i], self.r[i], self.d[i] = x, r, d
        if ns is not None:
            self.ns[i], self.na[i] = ns, na
        self.pos = (self.pos + 1) % self.cap
        self.n = min(self.n + 1, self.cap)

    def sample(self, rng: np.random.Generator, b: int):
        idx = rng.integers(0, self.n, size=b)
        return (torch.from_numpy(self.x[idx]), torch.from_numpy(self.r[idx]), torch.from_numpy(self.d[idx]),
                torch.from_numpy(self.ns[idx]), torch.from_numpy(self.na[idx]))


def epsilon(ep: int, a: argparse.Namespace) -> float:
    """学習初期は高い探索率を保ち、その後線形に下げる。"""
    if ep < a.eps_hold:
        return a.eps_start
    t = min(1.0, (ep - a.eps_hold) / max(1, a.eps_decay))
    return a.eps_start + (a.eps_end - a.eps_start) * t


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--episodes", type=int, default=40000)
    p.add_argument("--save-at", default=DEFAULT_SAVE_AT)
    p.add_argument("--save-every", type=int, default=0, help="このエピソード数ごとにも保存する")
    p.add_argument("--out", default="runs/main")
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--gamma", type=float, default=1.0)
    p.add_argument("--batch", type=int, default=64)
    p.add_argument("--buffer", type=int, default=50000)
    p.add_argument("--warmup", type=int, default=500)
    p.add_argument("--train-every", type=int, default=1)
    p.add_argument("--target-sync", type=int, default=1000)
    p.add_argument("--topk", type=int, default=32)
    p.add_argument("--eps-start", type=float, default=1.0)
    p.add_argument("--eps-end", type=float, default=0.05)
    p.add_argument("--eps-hold", type=int, default=300)
    p.add_argument("--eps-decay", type=int, default=10000)
    p.add_argument("--log-every", type=int, default=500)
    a = p.parse_args()

    random.seed(a.seed)
    np.random.seed(a.seed)
    torch.manual_seed(a.seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    rng = np.random.default_rng(a.seed)

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    save_at = sorted({int(s) for s in a.save_at.split(",") if s})
    (out / "config.json").write_text(json.dumps(vars(a), indent=2))

    online, target = QNet(), QNet()
    target.load_state_dict(online.state_dict())
    opt = torch.optim.Adam(online.parameters(), lr=a.lr)
    loss_fn = nn.SmoothL1Loss()
    replay = Replay(a.buffer, a.topk)
    cache = FeatureCache()

    updates = 0
    steps = 0
    recent_turns: list[int] = []
    recent_solved: list[bool] = []
    t0 = time.time()

    for ep in range(1, a.episodes + 1):
        eps = epsilon(ep - 1, a)
        env = HitBlowEnv(int(rng.integers(N_CODES)))
        pending: tuple[np.ndarray, float] | None = None
        last_fb = -1
        while True:
            s, act = cache.get(env.cands, env.turn)
            x = np.concatenate([np.broadcast_to(s, (N_CODES, N_STATE)), act], axis=1)
            with torch.no_grad():
                q = online(torch.from_numpy(x)).numpy().copy()
            q[env.guessed] = -np.inf

            if pending is not None:
                top = np.argpartition(-q, a.topk)[: a.topk]
                replay.add(pending[0], pending[1], 0.0, s, act[top])

            if rng.random() < eps:
                g = int(rng.integers(N_CODES))
                while g in env.guessed:
                    g = int(rng.integers(N_CODES))
            else:
                g = int(np.argmax(q))

            reward, done, last_fb = env.step(g)
            steps += 1
            if done:
                replay.add(x[g], reward, 1.0)
            else:
                pending = (x[g].copy(), reward)

            if replay.n >= a.warmup and steps % a.train_every == 0:
                bx, br, bd, bns, bna = replay.sample(rng, a.batch)
                with torch.no_grad():
                    nx = torch.cat([bns[:, None, :].expand(-1, a.topk, -1), bna], dim=2)
                    best = online(nx).argmax(dim=1, keepdim=True)
                    q_next = target(nx).gather(1, best).squeeze(1)
                    y = br + a.gamma * (1.0 - bd) * q_next
                loss = loss_fn(online(bx), y)
                opt.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(online.parameters(), 10.0)
                opt.step()
                updates += 1
                if updates % a.target_sync == 0:
                    target.load_state_dict(online.state_dict())

            if done:
                break

        solved = last_fb == WIN_FEEDBACK
        recent_turns.append(env.turn if solved else MAX_TURNS + 1)
        recent_solved.append(solved)

        if ep in save_at or (a.save_every and ep % a.save_every == 0):
            torch.save(online.state_dict(), out / f"ep{ep}.pt")
        if ep % a.log_every == 0:
            n = len(recent_turns)
            print(f"ep {ep:6d}  eps {eps:.3f}  turns(train) {sum(recent_turns)/n:.2f}  "
                  f"solved {sum(recent_solved)/n:.1%}  updates {updates}  {time.time()-t0:.0f}s", flush=True)
            recent_turns.clear()
            recent_solved.clear()

    torch.save(online.state_dict(), out / "final.pt")


if __name__ == "__main__":
    main()
