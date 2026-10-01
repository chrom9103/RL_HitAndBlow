import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from hitblow.codes import N_CODES, WIN_FEEDBACK, code_index, code_str, feedback_table, judge  # noqa: E402
from hitblow.env import HitBlowEnv  # noqa: E402
from hitblow.features import N_ACTION, N_STATE, action_features, state_features  # noqa: E402


@pytest.mark.parametrize(
    "secret,guess,hit,blow",
    [
        ("4071", "4071", 4, 0),
        ("1234", "4321", 0, 4),
        ("1234", "2143", 0, 4),
        ("1234", "5678", 0, 0),
        ("1234", "1243", 2, 2),
        ("1234", "1325", 1, 2),
        ("1234", "1235", 3, 0),
        ("4071", "1047", 1, 3),
    ],
)
def test_judge(secret, guess, hit, blow):
    assert judge(secret, guess) == (hit, blow)
    fb = feedback_table()
    assert fb[code_index(guess), code_index(secret)] == hit * 5 + blow


def test_codes_order_matches_app():
    assert N_CODES == 5040
    assert code_str(0) == "0123" and code_str(5039) == "9876"
    strs = [code_str(i) for i in range(N_CODES)]
    assert strs == sorted(strs)
    assert all(code_index(s) == i for i, s in enumerate(strs))


def test_feedback_table_matches_judge_and_is_symmetric():
    fb = feedback_table()
    assert (fb == fb.T).all()
    rng = np.random.default_rng(0)
    for g, s in rng.integers(0, N_CODES, size=(300, 2)):
        h, b = judge(code_str(s), code_str(g))
        assert fb[g, s] == h * 5 + b
    assert set(np.unique(fb)) == {h * 5 + b for h in range(5) for b in range(5 - h) if (h, b) != (3, 1)}


def test_first_guess_partition():
    fb = feedback_table()
    counts = np.bincount(fb[0], minlength=25)
    assert counts[0] == 360 and counts[1] == 1440 and counts[4] == 9 and counts[WIN_FEEDBACK] == 1


def test_features_full_set_symmetric():
    cands = np.arange(N_CODES)
    s = state_features(cands, 0)
    assert s.shape == (N_STATE,)
    assert s[0] == pytest.approx(1.0)
    assert np.allclose(s[3:].reshape(4, 10).sum(axis=1), 1.0)
    a = action_features(cands)
    assert a.shape == (N_CODES, N_ACTION)
    assert np.allclose(a, a[0])  # 1 手目はどの予想も同じ


def test_features_single_candidate():
    i = code_index("4071")
    a = action_features(np.array([i]))
    assert a[i, 0] == 1 and a[i, 1] == 1 and a[i, 2] == 1 and a[i, 4] == 1
    assert a[i, 3] == 0 and a[i, 7] == 0
    assert a[code_index("0123"), 0] == 0


def test_env_rewards():
    secret = code_index("4071")
    env = HitBlowEnv(secret)
    r, done, _ = env.step(code_index("0123"))
    assert r == -1 and not done
    assert secret in env.cands
    r, done, fb = env.step(secret)
    assert done and fb == WIN_FEEDBACK and r == -1 + 9

    env = HitBlowEnv(secret)
    miss = [i for i in range(N_CODES) if i != secret][:10]
    for t, g in enumerate(miss, 1):
        r, done, _ = env.step(g)
        assert done == (t == 10)
    assert r == -1 - 5
