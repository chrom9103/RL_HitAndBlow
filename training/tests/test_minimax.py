import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from hitblow.codes import N_CODES, code_index, code_str, feedback_table  # noqa: E402
from hitblow.minimax import best_guess, minimax_turns_all, play_minimax  # noqa: E402


def candidates(clues: list[tuple[str, int, int]]) -> np.ndarray:
    fb = feedback_table()
    cands = np.arange(N_CODES)
    for guess, hit, blow in clues:
        cands = cands[fb[code_index(guess), cands] == hit * 5 + blow]
    return cands


def test_example_position_matches_app():
    # app/src/hint/minimax.test.ts の「参考の経過」と同じ局面
    clues = [("1234", 0, 1), ("0156", 2, 0)]
    assert len(candidates(clues)) == 57
    clues.append(("0345", 1, 2))
    cands = candidates(clues)
    assert len(cands) == 6
    g = best_guess(cands)
    assert g in cands
    assert "0457" in [code_str(i) for i in cands]


def test_small_candidate_sets():
    assert best_guess(np.array([7, 9])) == 7
    assert best_guess(np.array([7])) == 7


def test_all_secrets_distribution_matches_app():
    # アプリ側の全数テスト(README「全数での結果」)と同じ分布・平均になる
    turns = minimax_turns_all()
    dist = np.bincount(turns, minlength=9)[1:8].tolist()
    assert dist == [1, 3, 44, 558, 2218, 2043, 173]
    assert turns.sum() == 26930


def test_play_minimax_agrees_with_tree():
    turns = minimax_turns_all()
    for s in [0, 1234, 4071, 5039]:
        g = play_minimax(s)
        assert g[-1] == s and len(g) == turns[s]
