"""難易度ごとの強さを計測する。

    python evaluate.py                      # difficulties.json の 3 難易度を 1,000 ゲームずつ計測 → results.md
    python evaluate.py --scan runs/main     # ラン内の全チェックポイントを計測(難易度の割り当てを決める用)

- 比較のため、プレイヤー向けヒントのミニマックス法(hitblow/minimax.py)と、難易度 Max の最適戦略
  (solve_optimal.py が書き出した決定木)も同じ秘密の数字で打たせる。

- 秘密の数字は固定シードで生成し、全員が同じ秘密で打つ。
- 平均回数は、10 回で当てられなかったゲームを 11 回として数える。
- 勝率は、ゲームのルールどおり「少ない回数で当てた方が勝ち、同じ回数・双方未達は引き分け」で判定する。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from hitblow.codes import N_CODES
from hitblow.minimax import minimax_turns_all
from hitblow.optimal import decode_tree, tree_turns
from hitblow.play import FAIL_TURNS, FeatureMemo, load_weights, play_agent, play_baseline, turns_to_solve

ROOT = Path(__file__).resolve().parent
MAX_TREE = ROOT.parent / "app" / "public" / "weights" / "max.bin"
DIFFICULTIES = ["easy", "normal", "hard"]
LABELS = {"easy": "Easy", "normal": "Normal", "hard": "Hard", "baseline": "基準プレイヤー", "minimax": "ミニマックス法(ヒント)",
          "max": "Max(最適戦略)"}


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


def _scan_one(args: tuple[Path, int, int]) -> tuple[str, np.ndarray]:
    path, n, seed = args
    return path.stem, agent_turns(path, secrets(n, seed), FeatureMemo())


def scan(run: Path, n: int, seed: int, jobs: int, every: int) -> None:
    secs = secrets(n, seed)
    base = baseline_turns(secs, seed)
    print(f"baseline           mean {base.mean():.3f}  solved {np.mean(base < FAIL_TURNS):.1%}")
    ckpts = sorted(run.glob("ep*.pt"), key=lambda p: int(re.findall(r"\d+", p.stem)[0]))
    ckpts = [p for p in ckpts if int(re.findall(r"\d+", p.stem)[0]) % every == 0]
    with ProcessPoolExecutor(max_workers=jobs) as pool:
        for name, t in pool.map(_scan_one, [(p, n, seed) for p in ckpts]):
            w, d, l = wdl(t, base)
            print(f"{name:<18} mean {t.mean():.3f}  solved {np.mean(t < FAIL_TURNS):.1%}  "
                  f"vs baseline W/D/L {w:.1%}/{d:.1%}/{l:.1%}", flush=True)


def full(n: int, seed: int) -> None:
    cfg = json.loads((ROOT / "difficulties.json").read_text())
    run = ROOT / cfg["run"]
    secs = secrets(n, seed)
    memo = FeatureMemo()
    turns = {"baseline": baseline_turns(secs, seed)}
    for d in DIFFICULTIES:
        turns[d] = agent_turns(run / f"{cfg[d]}.pt", secs, memo)
    # ミニマックス法は決定的なので、全 5,040 通りの回数を一度に求めて引く
    minimax_all = minimax_turns_all()
    turns["minimax"] = minimax_all[secs]
    # Max も決定的(アプリでは対戦ごとに数字を付け替えるが、回数の分布は同じ)
    max_all = tree_turns(decode_tree(MAX_TREE.read_bytes()))
    turns["max"] = max_all[secs]

    result = {
        "games": n,
        "seed": seed,
        "checkpoints": {d: cfg[d] for d in DIFFICULTIES},
        "summary": {k: summary(v) for k, v in turns.items()},
        "vs_baseline": {d: dict(zip(["win", "draw", "lose"], wdl(turns[d], turns["baseline"])))
                        for d in [*DIFFICULTIES, "minimax", "max"]},
        "head_to_head": {
            f"{a}_vs_{b}": dict(zip(["win", "draw", "lose"], wdl(turns[a], turns[b])))
            for i, a in enumerate(DIFFICULTIES) for b in DIFFICULTIES[i + 1:]
        },
        "vs_minimax": {d: dict(zip(["win", "draw", "lose"], wdl(turns[d], turns["minimax"]))) for d in DIFFICULTIES},
        "vs_max": {d: dict(zip(["win", "draw", "lose"], wdl(turns[d], turns["max"])))
                   for d in [*DIFFICULTIES, "minimax"]},
        "minimax_all_secrets": summary(minimax_all),
        "max_all_secrets": summary(max_all),
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
    for d in [*DIFFICULTIES, "max"]:
        s, v = r["summary"][d], r["vs_baseline"][d]
        lines.append(f"| {LABELS[d]} | {r['checkpoints'].get(d, '—')} | {s['mean_turns']:.2f} | {pct(s['solved_rate'])} | "
                     f"{pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    m, mv = r["summary"]["minimax"], r["vs_baseline"]["minimax"]
    lines.append(f"| ({LABELS['minimax']}) | — | {m['mean_turns']:.2f} | {pct(m['solved_rate'])} | "
                 f"{pct(mv['win'])} / {pct(mv['draw'])} / {pct(mv['lose'])} |")
    b = r["summary"]["baseline"]
    lines.append(f"| (基準プレイヤー) | — | {b['mean_turns']:.2f} | {pct(b['solved_rate'])} | — |")
    lines += ["", "| 対戦 | 勝ち / 引き分け / 負け |", "|---|---|"]
    for k, v in r["head_to_head"].items():
        a, b2 = k.split("_vs_")
        lines.append(f"| {LABELS[a]} 対 {LABELS[b2]} | {pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    for d, v in r["vs_minimax"].items():
        lines.append(f"| {LABELS[d]} 対 {LABELS['minimax']} | {pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    for d, v in r["vs_max"].items():
        lines.append(f"| {LABELS[d]} 対 {LABELS['max']} | {pct(v['win'])} / {pct(v['draw'])} / {pct(v['lose'])} |")
    lines += ["", "当てるまでの回数の分布(11 = 10 回で当てられず)", "",
              "| | " + " | ".join(str(i) for i in range(1, FAIL_TURNS + 1)) + " |",
              "|---" * (FAIL_TURNS + 1) + "|"]
    for k in ["easy", "normal", "hard", "max", "minimax", "baseline"]:
        lines.append(f"| {LABELS[k]} | " + " | ".join(str(c) for c in r["distribution"][k]) + " |")
    a = r["minimax_all_secrets"]
    x = r["max_all_secrets"]
    lines += ["", f"参考: 秘密の数字 5,040 通りすべてで打つと、ミニマックス法は平均 {a['mean_turns']:.3f} 回・最悪 {a['max_turns']} 回、"
              f"Max は平均 {x['mean_turns']:.4f} 回・最悪 {x['max_turns']} 回"]
    return "\n".join(lines) + "\n"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    p.add_argument("--scan", type=Path)
    p.add_argument("--games", type=int, default=1000)
    p.add_argument("--seed", type=int, default=12345)
    p.add_argument("--jobs", type=int, default=8, help="--scan で並列に計測するプロセス数")
    p.add_argument("--every", type=int, default=1, help="--scan でこのエピソード数の倍数のチェックポイントだけ計測")
    a = p.parse_args()
    if a.scan:
        scan(a.scan, a.games, a.seed, a.jobs, a.every)
    else:
        full(a.games, a.seed)


if __name__ == "__main__":
    main()
