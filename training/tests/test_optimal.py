import json
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from hitblow.codes import N_CODES, N_FEEDBACK, WIN_FEEDBACK, code_index, code_str, feedback_table  # noqa: E402
from hitblow.optimal import (  # noqa: E402
    CODE_LOOKUP, CODES64, LB, PERMS4, _hist, decode_tree, encode_tree, representatives, solve_set, tree_guess,
    tree_turns,
)

ROOT = Path(__file__).resolve().parents[1]
MAX_BIN = ROOT.parent / "app" / "public" / "weights" / "max.bin"


def candidates(clues: list[tuple[str, int, int]]) -> np.ndarray:
    fb = feedback_table()
    cands = np.arange(N_CODES)
    for guess, hit, blow in clues:
        cands = cands[fb[code_index(guess), cands] == hit * 5 + blow]
    return cands


def brute_force(s: np.ndarray) -> int:
    """対称性も枝刈りも使わない f(S)(小さい集合用)。"""
    fb = feedback_table()

    @lru_cache(maxsize=None)
    def f(key: tuple[int, ...]) -> int:
        if len(key) == 1:
            return 1
        arr = np.array(key)
        best = None
        for g in range(N_CODES):
            parts = fb[g, arr]
            values = np.unique(parts)
            if len(values) == 1 and values[0] != WIN_FEEDBACK:
                continue
            cost = len(key) + sum(f(tuple(arr[parts == r])) for r in values if r != WIN_FEEDBACK)
            if best is None or cost < best:
                best = cost
        return best

    return f(tuple(int(x) for x in s))


def test_lower_bounds():
    assert LB[1] == 1 and LB[2] == 3 and LB[14] == 27
    assert LB[15] == 27 + 3  # 15 個目は深さ 3


def test_representatives_first_move():
    # 何も予想していなければ、すべての予想が 0123 と同値
    rep = representatives(_hist(), 0, CODES64, PERMS4, CODE_LOOKUP)
    assert np.flatnonzero(rep).tolist() == [0]
    # 0123 の後: 使った数字の個数と、その位置の当たり方で分類される。代表は各同値類で辞書順最小
    rep = representatives(_hist(0), 1, CODES64, PERMS4, CODE_LOOKUP)
    assert rep[0] and rep[code_index("4567")] and not rep[code_index("4568")]
    assert not rep[code_index("1023")] and rep[code_index("0132")]


@pytest.mark.parametrize(
    "clues",
    [
        [("0123", 0, 0), ("5106", 1, 1), ("7496", 1, 2)],
        [("0123", 2, 1), ("1497", 1, 1)],
        [("0123", 0, 1), ("3106", 1, 0), ("8615", 0, 2), ("4208", 0, 2)],
        [("0123", 0, 1), ("8249", 0, 1), ("2610", 1, 1), ("4086", 1, 0)],
    ],
)
def test_solver_matches_brute_force(clues):
    s = candidates(clues)
    assert 3 <= len(s) <= 12
    assert solve_set(s, [code_index(g) for g, _, _ in clues]) == brute_force(s)


def test_encode_decode_roundtrip():
    tree = {"g": 5, "c": {0: {"g": 7, "c": {}}, 6: {"g": 8, "c": {21: {"g": 9, "c": {}}}}}}
    assert decode_tree(encode_tree(tree)) == tree
    assert tree_guess(tree, [(5, 6), (8, 21)]) == 9


@pytest.mark.skipif(not MAX_BIN.exists(), reason="solve_optimal.py を実行すると生成される")
def test_exported_tree_is_optimal():
    summary = json.loads((ROOT / "optimal.json").read_text())
    tree = decode_tree(MAX_BIN.read_bytes())
    turns = tree_turns(tree)
    assert turns.sum() == summary["total_turns"]
    assert turns.max() == summary["max_turns"] <= 7
    assert code_str(tree["g"]) == "0123"
    # 当たり以外の判定ごとに子があり、子の数は起こりうる判定の数と一致する
    fb = feedback_table()
    assert sorted(tree["c"]) == [int(r) for r in np.unique(fb[0]) if r != WIN_FEEDBACK]
    assert all(r < N_FEEDBACK for r in tree["c"])


def test_second_guess_returns_optimal_subtree():
    # 1 手目 0123 の判定が 2H1B(候補 72 個)の局面。上限未満で解けた 2 手目は、その総手数どおりの部分木を返す
    from hitblow.optimal import FIRST_GUESS, _second_guess_cost, greedy_total

    fb = feedback_table()
    r1 = 2 * 5 + 1
    s1 = np.flatnonzero(fb[FIRST_GUESS] == r1)
    ub = int(greedy_total(s1.astype(np.int64), fb)) + 1
    rep = representatives(_hist(FIRST_GUESS), 1, CODES64, PERMS4, CODE_LOOKUP)
    results = [_second_guess_cost((r1, int(g2), ub)) for g2 in np.flatnonzero(rep)]
    solved = [(cost, g2, tree) for _, g2, cost, tree in results if cost < ub]
    assert solved and all(tree is not None for _, _, tree in solved)
    assert all(tree is None for _, _, cost, tree in results if cost >= ub)
    best = min(c for c, _, _ in solved)
    assert best == solve_set(s1, [FIRST_GUESS])
    for cost, g2, tree in solved:
        assert tree["g"] == g2

        def total(n: dict, s: np.ndarray) -> int:
            parts = fb[n["g"], s]
            return len(s) + sum(total(n["c"][int(r)], s[parts == r]) for r in np.unique(parts) if r != WIN_FEEDBACK)

        assert total(tree, s1) == cost
