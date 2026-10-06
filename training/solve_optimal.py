"""難易度 Max: 平均回数を最小にする最適戦略をゲーム木の全探索で求め、決定木をアプリ用に書き出す。

    python solve_optimal.py [--workers N]

既定では論理コア数ぶんのプロセスで並列に解く(1 プロセスあたり約 200 MB)。

出力:
  app/public/weights/max.bin    決定木(形式は hitblow/optimal.py の encode_tree、app/src/cpu/tree.ts)
  optimal.json                  総手数・平均・回数の分布・1 手目の判定ごとの最善の 2 手目
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from hitblow.codes import N_CODES, code_str
from hitblow.optimal import build_tree, encode_tree, solve_root, tree_turns

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "app"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=None)
    args = ap.parse_args()

    t0 = time.time()
    log = lambda m: print(f"[{time.time() - t0:7.1f}s] {m}", flush=True)  # noqa: E731
    found = solve_root(args.workers, log=log)
    total = N_CODES + sum(c for c, _, _ in found.values())
    log(f"最小の総手数: {total}(平均 {total / N_CODES:.4f} 回)")

    tree = build_tree(found)
    turns = tree_turns(tree)
    if int(turns.sum()) != total:
        raise SystemExit(f"決定木の総手数 {turns.sum()} が探索結果 {total} と一致しません")
    data = encode_tree(tree)
    out = APP / "public" / "weights" / "max.bin"
    out.write_bytes(data)
    elapsed = time.time() - t0

    dist = np.bincount(turns, minlength=8)[1:].tolist()
    summary = {
        "total_turns": total,
        "mean_turns": total / N_CODES,
        "max_turns": int(turns.max()),
        "distribution": {str(i + 1): n for i, n in enumerate(dist) if n},
        "nodes": len(data) // 6,
        "bytes": len(data),
        "seconds": round(elapsed),
        # 1 手目 0123 の判定(hit*5 + blow)ごとの最善の 2 手目
        "second_guesses": {str(r1): code_str(g2) for r1, (_, g2, _) in sorted(found.items())},
    }
    (ROOT / "optimal.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(summary, ensure_ascii=False))
    print(f"→ {out.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
