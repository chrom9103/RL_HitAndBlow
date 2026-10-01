"""難易度ごとの強さを計測する。

    python evaluate.py                      # difficulties.json の 3 難易度を 1,000 ゲームずつ計測 → results.md
    python evaluate.py --scan runs/main     # ラン内の全チェックポイントを計測(難易度の割り当てを決める用)

- 秘密の数字は固定シードで生成し、全員が同じ秘密で打つ。
- 平均回数は、10 回で当てられなかったゲームを 11 回として数える。
- 勝率は、ゲームのルールどおり「少ない回数で当てた方が勝ち、同じ回数・双方未達は引き分け」で判定する。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np

from hitblow.codes import N_CODES
from hitblow.play import FAIL_TURNS, FeatureMemo, load_weights, play_agent, play_baseline, turns_to_solve

ROOT = Path(__file__).resolve().parent
DIFFICULTIES = ["easy", "normal", "hard"]
LABELS = {"easy": "Easy", "normal": "Normal", "hard": "Hard", "baseline": "基準プレイヤー"}


def secrets(n: int, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, N_CODES, size=n)


def agent_turns(path: Path, secs: np.ndarray, memo: FeatureMemo) -> np.ndarray:
    w = load_weights(path)
    return np.array([turns_to_solve(play_agent(w, int(s), memo), int(s)) for s in secs])


def baseline_turns(secs: np.ndarray, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed + 1)
    return np.array([turns_to_solve(play_baseline(int(s), rng), int(s)) for s in secs])


def wdl(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """a から見た 勝ち・引き分け・負け の割合。"""
    a_ok, b_ok = a < FAIL_TURNS, b < FAIL_TURNS
    win = (a_ok & (~b_ok | (a < b))).mean()
    lose = (b_ok & (~a_ok | (b < a))).mean()
    return float(win), float(1 - win - lose), float(lose)


def summary(t: np.ndarray) -> dict:
    ok = t < FAIL_TURNS
    return {
        "mean_turns": float(t.mean()),
        "mean_turns_solved": float(t[ok].mean()) if ok.any() else None,
        "solved_rate": float(ok.mean()),
        "max_turns": int(t.max()),
    }


def scan(run: Path, n: int, seed: int) -> None:
    secs = secrets(n, seed)
    memo = FeatureMemo()
    base = baseline_turns(secs, seed)
    print(f"baseline           mean {base.mean():.3f}  solved {np.mean(base < FAIL_TURNS):.1%}")
    ckpts = sorted(run.glob("ep*.pt"), key=lambda p: int(re.findall(r"\d+", p.stem)[0]))
    for p in ckpts:
        t = agent_turns(p, secs, memo)
        w, d, l = wdl(t, base)
        print(f"{p.stem:<18} mean {t.mean():.3f}  solved {np.mean(t < FAIL_TURNS):.1%}  "
              f"vs baseline W/D/L {w:.1%}/{d:.1%}/{l:.1%}", flush=True)


def full(n: int, seed: int) -> None:
    cfg = json.loads((ROOT / "difficulties.json").read_text())
    run = ROOT / cfg["run"]
    secs = secrets(n, seed)
    memo = FeatureMemo()
    turns = {"baseline": baseline_turns(secs, seed)}
    for d in DIFFICULTIES:
        turns[d] = agent_turns(run / f"{cfg[d]}.pt", secs, memo)

    result = {
        "games": n,
        "seed": seed,
        "checkpoints": {d: cfg[d] for d in DIFFICULTIES},
        "summary": {k: summary(v) for k, v in turns.items()},
        "vs_baseline": {d: dict(zip(["win", "draw", "lose"], wdl(turns[d], turns["baseline"]))) for d in DIFFICULTIES},
        "head_to_head": {
            f"{a}_vs_{b}": dict(zip(["win", "draw", "lose"], wdl(turns[a], turns[b])))
            for i, a in enumerate(DIFFICULTIES) for b in DIFFICULTIES[i + 1:]
        },
        "distribution": {k: np.bincount(v, minlength=FAIL_TURNS + 1)[1:].tolist() for k, v in turns.items()},
    }
    (ROOT / "results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    (ROOT / "results.md").write_text(to_markdown(result), encoding="utf-8")
    print(to_markdown(result))


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def to_markdown(r: dict) -> str:
    lines = [f"計測: {r['games']:,} ゲーム(秘密の数字はシード {r['seed']} で生成、全員共通)", ""]
    lines += ["| 難易度 | チェックポイント | 平均回数 | 10回以内に当てた割合 | 基準プレイヤーに 勝ち / 引き分け / 負け |",
              "|---|---|---|---|---|"]
    for d in DIFFICULTIES:
        s, v = r["summary"][d], r["vs_baseline"][d]
        lines.append(f"| {LABELS[d]} | {r['checkpoints'][d]} | {s['mean_turns']:.2f} | {pct(s['solved_rate'])} | "
                     f"{pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    b = r["summary"]["baseline"]
    lines.append(f"| (基準プレイヤー) | — | {b['mean_turns']:.2f} | {pct(b['solved_rate'])} | — |")
    lines += ["", "| 対戦 | 勝ち / 引き分け / 負け |", "|---|---|"]
    for k, v in r["head_to_head"].items():
        a, b2 = k.split("_vs_")
        lines.append(f"| {LABELS[a]} 対 {LABELS[b2]} | {pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    lines += ["", "当てるまでの回数の分布(11 = 10 回で当てられず)", "",
              "| | " + " | ".join(str(i) for i in range(1, FAIL_TURNS + 1)) + " |",
              "|---" * (FAIL_TURNS + 1) + "|"]
    for k in ["easy", "normal", "hard", "baseline"]:
        lines.append(f"| {LABELS[k]} | " + " | ".join(str(c) for c in r["distribution"][k]) + " |")
    return "\n".join(lines) + "\n"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--scan", type=Path)
    p.add_argument("--games", type=int, default=1000)
    p.add_argument("--seed", type=int, default=12345)
    a = p.parse_args()
    if a.scan:
        scan(a.scan, a.games, a.seed)
    else:
        full(a.games, a.seed)


if __name__ == "__main__":
    main()
