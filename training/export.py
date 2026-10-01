"""difficulties.json のチェックポイントを、アプリ用の重みと一致テスト用データに書き出す。

    python export.py

出力:
  app/public/weights/{easy,normal,hard}.bin   float32 リトルエンディアン(層ごとに W (out, in) → b)
  app/public/weights/manifest.json            層の大きさとファイル名
  app/src/cpu/__fixtures__/parity.json        Python の参照推論の結果(TS 側の一致テストで使う)
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from hitblow.codes import N_CODES, code_str, feedback_table
from hitblow.features import action_features, state_features
from hitblow.model import QNet
from hitblow.play import flat_weights, layer_sizes
from hitblow.policy import TIE_EPS, Weights, forward, select

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "app"
DIFFICULTIES = ["easy", "normal", "hard"]
PARITY_GAMES = 5
PROBE_ACTIONS = [0, 1, 777, 2520, 5039]


def export_weights() -> dict[str, Weights]:
    cfg = json.loads((ROOT / "difficulties.json").read_text())
    out = APP / "public" / "weights"
    out.mkdir(parents=True, exist_ok=True)
    weights = {}
    sizes: list[int] = []
    for d in DIFFICULTIES:
        net = QNet()
        net.load_state_dict(torch.load(ROOT / cfg["run"] / f"{cfg[d]}.pt", map_location="cpu", weights_only=True))
        flat = flat_weights(net)
        sizes = layer_sizes(net)
        (out / f"{d}.bin").write_bytes(flat.astype("<f4").tobytes())
        weights[d] = Weights.from_flat(flat, sizes)
        print(f"{d}: {cfg[d]}  {flat.nbytes / 1024:.1f} KB")
    manifest = {"version": 1, "sizes": sizes, "files": {d: f"{d}.bin" for d in DIFFICULTIES}}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return weights


def parity_cases(weights: dict[str, Weights]) -> list[dict]:
    fb = feedback_table()
    rng = np.random.default_rng(2024)
    cases = []
    for d in DIFFICULTIES:
        for secret in rng.integers(0, N_CODES, size=PARITY_GAMES):
            cands = np.arange(N_CODES)
            turns: list[dict] = []
            guessed: list[int] = []
            for turn in range(10):
                s = state_features(cands, turn)
                a = action_features(cands)
                x = np.concatenate([np.broadcast_to(s, (N_CODES, len(s))), a], axis=1)
                q = forward(weights[d], x)
                g = select(q, guessed)
                probes = sorted(set(PROBE_ACTIONS + [g]))
                cases.append({
                    "difficulty": d,
                    "turns": list(turns),
                    "candidates": int(len(cands)),
                    "expected": code_str(g),
                    "state": s.tolist(),
                    "probes": [{"index": int(i), "action": a[i].tolist(), "q": float(q[i])} for i in probes],
                })
                r = int(fb[g, secret])
                turns.append({"guess": code_str(g), "hit": r // 5, "blow": r % 5})
                guessed.append(g)
                if g == secret:
                    break
                cands = cands[fb[g, cands] == r]
    return cases


def main() -> None:
    weights = export_weights()
    cases = parity_cases(weights)
    path = APP / "src" / "cpu" / "__fixtures__" / "parity.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"tieEps": TIE_EPS, "cases": cases}) + "\n")
    print(f"parity cases: {len(cases)} → {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
