"""平均回数を最小にする最適戦略(難易度 Max)を、ゲーム木の全探索で厳密に求める。

候補集合 S の秘密の数字すべてを当てきるまでの総手数の最小値を f(S) とすると

    f(S) = min_g ( |S| + Σ_{判定 r ≠ 4H} f(S_r) )      (S_r は予想 g で判定 r になる候補)

で、平均回数の最小値は f(全 5,040 通り) / 5,040。これを次の工夫で計算する。

- 下界による分枝限定: n 個の候補を当てきる総手数は、外れの判定が 13 種類しかないことから
  LB(n)(深さ d で当たるのは最大 13^(d-1) 個)以上。予想ごとの下界 |S| + Σ LB(|S_r|) の小さい順に調べ、
  下界が暫定の最良以上になったら打ち切る。部分問題にも「これ未満なら正確な値が欲しい」という上限を渡し、
  上限以上と分かった時点で打ち切る(fail-high)。
- 対称性: これまでの予想をすべて動かさない「桁の並べ替え × 数字の付け替え」で互いに移り合う予想は
  同じ総手数になるので、代表 1 つだけを調べる(まだ出ていない数字どうしの入れ替えを含む)。
- メモ化: f(S) は S だけで決まるので、S のハッシュをキーに結果(と最善の予想)を保存する。

1 手目はどの予想も同じなので 0123 に固定する。2 手目以降をプロセスに分けて並列に計算する。
"""
from __future__ import annotations

import itertools
import os
from concurrent.futures import ProcessPoolExecutor, as_completed

import numpy as np
from numba import njit, types
from numba.typed import Dict

from .codes import CODES, MAX_TURNS, N_CODES, N_FEEDBACK, WIN_FEEDBACK, feedback_table

N_RESP = 13  # 当たり以外の判定の種類数
INF = 1 << 40
GUESS_BITS = 13  # メモの値 = f * 2^13 + 最善の予想
FIRST_GUESS = 0  # "0123"

PERMS4 = np.array(list(itertools.permutations(range(4))), dtype=np.int64)
CODES64 = CODES.astype(np.int64)


def _code_lookup() -> np.ndarray:
    table = np.full(10000, -1, dtype=np.int64)
    for i, c in enumerate(CODES.tolist()):
        table[c[0] * 1000 + c[1] * 100 + c[2] * 10 + c[3]] = i
    return table


CODE_LOOKUP = _code_lookup()


def lower_bounds(n_max: int = N_CODES) -> np.ndarray:
    """LB[n]: n 個の候補を当てきる総手数の下界。深さ d で当たるのは最大 13^(d-1) 個。"""
    lb = np.zeros(n_max + 1, dtype=np.int64)
    for n in range(1, n_max + 1):
        remaining, depth, cap, total = n, 1, 1, 0
        while remaining > 0:
            take = min(cap, remaining)
            total += take * depth
            remaining -= take
            depth += 1
            cap *= N_RESP
        lb[n] = total
    return lb


LB = lower_bounds()


def new_memo() -> tuple[Dict, Dict]:
    key_t = types.UniTuple(types.int64, 2)
    exact = Dict.empty(key_type=key_t, value_type=types.int64)
    lower = Dict.empty(key_type=key_t, value_type=types.int64)
    return exact, lower


@njit(cache=True)
def _set_key(s):
    h1 = np.int64(1469598103934665603)
    h2 = np.int64(len(s))
    for x in s:
        h1 = (h1 ^ np.int64(x)) * np.int64(1099511628211)
        h2 = h2 * np.int64(1000003) + np.int64(x) * np.int64(2654435761) + np.int64(7)
    return (h1, h2)


@njit(cache=True)
def representatives(hist, hlen, codes, perms, lookup):
    """これまでの予想 hist[:hlen] をすべて動かさない対称性で、予想を代表だけに絞る(代表なら True)。"""
    n_codes = codes.shape[0]
    mentioned = np.zeros(10, dtype=np.bool_)
    for k in range(hlen):
        for i in range(4):
            mentioned[codes[hist[k], i]] = True
    fresh = np.empty(10, dtype=np.int64)
    nf = 0
    for d in range(10):
        if not mentioned[d]:
            fresh[nf] = d
            nf += 1

    # 桁の並べ替え π ごとに、数字の付け替え σ(出てきた数字の上では一意に決まる)が矛盾しないものを集める
    sigmas = np.empty((perms.shape[0], 10), dtype=np.int64)
    ok_perm = np.zeros(perms.shape[0], dtype=np.bool_)
    for p in range(perms.shape[0]):
        sigma = np.full(10, -1, dtype=np.int64)
        used = np.zeros(10, dtype=np.bool_)
        ok = True
        for k in range(hlen):
            if not ok:
                break
            for i in range(4):
                src = codes[hist[k], perms[p, i]]
                dst = codes[hist[k], i]
                if sigma[src] == -1:
                    if used[dst]:
                        ok = False
                        break
                    sigma[src] = dst
                    used[dst] = True
                elif sigma[src] != dst:
                    ok = False
                    break
        if ok:
            ok_perm[p] = True
            sigmas[p] = sigma

    rep = np.zeros(n_codes, dtype=np.bool_)
    fmap = np.empty(10, dtype=np.int64)
    for g in range(n_codes):
        best = n_codes
        for p in range(perms.shape[0]):
            if not ok_perm[p]:
                continue
            for d in range(10):
                fmap[d] = -1
            used_f = 0
            v = 0
            for i in range(4):
                d = codes[g, perms[p, i]]
                if mentioned[d]:
                    t = sigmas[p, d]
                else:
                    # まだ出ていない数字は、出てきた順に小さいものへ付け替える(辞書順で最小)
                    if fmap[d] == -1:
                        fmap[d] = fresh[used_f]
                        used_f += 1
                    t = fmap[d]
                v = v * 10 + t
            idx = lookup[v]
            if idx < best:
                best = idx
        rep[g] = best == g
    return rep


@njit(cache=True)
def _split(s, g, fb, n_fb):
    """予想 g で s を判定ごとに分ける。(判定ごとの個数, 判定ごとに並べ替えた s, 各判定の開始位置)"""
    counts = np.zeros(n_fb, dtype=np.int64)
    for x in s:
        counts[fb[g, x]] += 1
    start = np.zeros(n_fb + 1, dtype=np.int64)
    for r in range(n_fb):
        start[r + 1] = start[r] + counts[r]
    pos = start[:n_fb].copy()
    out = np.empty(len(s), dtype=s.dtype)
    for x in s:
        r = fb[g, x]
        out[pos[r]] = x
        pos[r] += 1
    return counts, out, start


@njit(cache=True)
def solve(s, ub, hist, hlen, fb, lb, codes, perms, lookup, exact, lower):
    """f(s) < ub なら f(s) を正確に返す。そうでなければ ub 以上の値(f(s) の下界)を返す。

    s は昇順のインデックス。hist[:hlen] はこれまでの予想(対称性の判定に使う)。
    """
    n = len(s)
    if n == 1:
        return np.int64(1)
    if n == 2:
        return np.int64(3)
    key = _set_key(s)
    if key in exact:
        return exact[key] >> 13
    if key in lower:
        known = lower[key]
        if known >= ub:
            return known
    n_codes = fb.shape[0]
    n_fb = 25  # N_FEEDBACK
    win = 20  # WIN_FEEDBACK

    in_s = np.zeros(n_codes, dtype=np.bool_)
    for x in s:
        in_s[x] = True

    # 予想ごとの下界と、並べ替えのキー(下界 → 候補に含まれる → 二乗和)
    rep = representatives(hist, hlen, codes, perms, lookup)
    guesses = np.empty(n_codes, dtype=np.int64)
    bounds = np.empty(n_codes, dtype=np.int64)
    keys = np.empty(n_codes, dtype=np.int64)
    m = 0
    counts = np.zeros(n_fb, dtype=np.int64)
    for g in range(n_codes):
        if not rep[g]:
            continue
        for r in range(n_fb):
            counts[r] = 0
        for x in s:
            counts[fb[g, x]] += 1
        if not in_s[g]:
            useless = False
            for r in range(n_fb):
                if counts[r] == n:
                    useless = True
            if useless:
                continue
        b = n
        sq = 0
        for r in range(n_fb):
            if r != win:
                b += lb[counts[r]]
            sq += counts[r] * counts[r]
        guesses[m] = g
        bounds[m] = b
        keys[m] = (b << 40) + ((0 if in_s[g] else 1) << 39) + sq
        m += 1
    order = np.argsort(keys[:m], kind="mergesort")

    best = ub
    best_g = -1
    for oi in range(m):
        k = order[oi]
        g = guesses[k]
        cost = bounds[k]
        if cost >= best:
            break
        counts, parts, start = _split(s, g, fb, n_fb)
        # 大きいグループから解く(下界との差が大きく、早く打ち切れることが多い)
        part_order = np.argsort(-counts)
        hist[hlen] = g
        for pi in range(n_fb):
            r = part_order[pi]
            c = counts[r]
            if c <= 2:
                break
            if r == win:
                continue
            sub_ub = best - (cost - lb[c])
            v = solve(parts[start[r]:start[r + 1]], sub_ub, hist, hlen + 1,
                      fb, lb, codes, perms, lookup, exact, lower)
            cost += v - lb[c]
            if cost >= best:
                break
        if cost < best:
            best = cost
            best_g = g
            if best == lb[n]:
                break

    if best_g >= 0:
        exact[key] = (best << 13) + best_g
        return best
    prev = lower[key] if key in lower else 0
    lower[key] = max(prev, ub)
    return ub


@njit(cache=True)
def greedy_total(s, fb):
    """1 手読み(グループの大きさの二乗和が最小、同じなら候補に含まれる予想)で打ったときの総手数。上限に使う。"""
    n = len(s)
    if n == 1:
        return np.int64(1)
    n_codes = fb.shape[0]
    in_s = np.zeros(n_codes, dtype=np.bool_)
    for x in s:
        in_s[x] = True
    counts = np.zeros(25, dtype=np.int64)
    best_key = np.int64(1) << 62
    best_g = -1
    for g in range(n_codes):
        for r in range(25):
            counts[r] = 0
        for x in s:
            counts[fb[g, x]] += 1
        sq = 0
        for r in range(25):
            sq += counts[r] * counts[r]
        if sq == n * n and not in_s[g]:
            continue
        key = sq * 2 + (0 if in_s[g] else 1)
        if key < best_key:
            best_key = key
            best_g = g
    counts, parts, start = _split(s, best_g, fb, 25)
    total = np.int64(n)
    for r in range(25):
        if r != 20 and counts[r] > 0:
            total += greedy_total(parts[start[r]:start[r + 1]], fb)
    return total


# --- 並列化と木の組み立て(Python 側) ---------------------------------------------------------

_WORKER: dict = {}


def _ctx():
    if not _WORKER:
        exact, lower = new_memo()
        _WORKER.update(fb=feedback_table(), exact=exact, lower=lower)
    return _WORKER


def _hist(*guesses: int) -> np.ndarray:
    h = np.zeros(MAX_TURNS + 2, dtype=np.int64)
    h[: len(guesses)] = guesses
    return h


def solve_set(s: np.ndarray, hist: list[int], ub: int = INF) -> int:
    c = _ctx()
    return int(solve(np.asarray(s, dtype=np.int64), ub, _hist(*hist), len(hist),
                     c["fb"], LB, CODES64, PERMS4, CODE_LOOKUP, c["exact"], c["lower"]))


def _second_guess_cost(args) -> tuple[int, int, int, dict | None]:
    """1 手目 0123 の判定が r1 だった局面で、2 手目を g2 にしたときの総手数(ub 以上なら ub 以上の値)。

    総手数が ub 未満(正確な値)なら、その局面からの決定木も返す。このとき各部分問題は最善手まで
    メモに残っているので、木の組み立てはメモを引くだけで済む(別プロセスで解き直さない)。
    """
    r1, g2, ub = args
    fb = feedback_table()
    s1 = np.flatnonzero(fb[FIRST_GUESS] == r1)
    cost = len(s1)
    parts = fb[g2, s1]
    for r in np.unique(parts):
        if r == WIN_FEEDBACK:
            continue
        part = s1[parts == r]
        sub = solve_set(part, [FIRST_GUESS, g2], max(ub - cost, 1)) if len(part) > 0 else 0
        cost += sub
        if cost >= ub:
            break
    tree = _subtree(s1, [FIRST_GUESS], g2) if cost < ub else None
    return r1, g2, cost, tree


def solve_root(workers: int | None = None, log=print) -> dict[int, tuple[int, int, dict]]:
    """1 手目 0123 の判定ごとに (f(S1), 最善の 2 手目, その判定からの決定木) を求める。"""
    fb = feedback_table()
    rep = representatives(_hist(FIRST_GUESS), 1, CODES64, PERMS4, CODE_LOOKUP)
    tasks: list[tuple[int, int]] = []
    responses = [int(r) for r in np.unique(fb[FIRST_GUESS]) if r != WIN_FEEDBACK]
    for r1 in responses:
        s1 = np.flatnonzero(fb[FIRST_GUESS] == r1)
        for g2 in np.flatnonzero(rep):
            sizes = np.bincount(fb[g2, s1], minlength=N_FEEDBACK)
            if g2 not in s1 and sizes.max() == len(s1):
                continue
            bound = len(s1) + sum(int(LB[c]) for r, c in enumerate(sizes) if r != WIN_FEEDBACK)
            tasks.append((bound, r1, int(g2)))
    # 判定ごとに 1 手読みの総手数を上限にして、すべての 2 手目を並列に解く(上限 + 1 未満なら正確な値が返る)
    greedy = {r1: int(greedy_total(np.flatnonzero(fb[FIRST_GUESS] == r1).astype(np.int64), fb)) for r1 in responses}
    log(f"1 手読みの総手数: {len(fb) + sum(greedy.values())}(平均 {(len(fb) + sum(greedy.values())) / len(fb):.4f} 回)")
    ub = {r1: v + 1 for r1, v in greedy.items()}
    rest = sorted((t for t in tasks if t[0] < ub[t[1]]), key=lambda t: -len(np.flatnonzero(fb[FIRST_GUESS] == t[1])))
    log(f"2 手目の候補: {len(tasks)} 通り(対称性で絞った後)、うち下界が上限未満の {len(rest)} 通りを解く")
    best: dict[int, tuple[int, int, dict | None]] = {r1: (ub[r1], -1, None) for r1 in responses}
    workers = workers or os.cpu_count() or 1
    with ProcessPoolExecutor(max_workers=workers) as ex:
        # 大きい集合のものから投入する(時間がかかるので先に始める)
        futures = [ex.submit(_second_guess_cost, (r1, g2, ub[r1])) for _, r1, g2 in rest]
        for done, fut in enumerate(as_completed(futures), 1):
            r1, g2, cost, tree = fut.result()
            if done % 10 == 0 or done == len(futures):
                log(f"{done}/{len(futures)} 通り確認")
            # 上限以上の値は打ち切られた下界なので、上限未満(= 正確な値)のときだけ採用する
            if cost < best[r1][0] or (cost == best[r1][0] and best[r1][1] >= 0 and g2 < best[r1][1]):
                best[r1] = (cost, g2, tree)
    return best


def _subtree(s: np.ndarray, hist: list[int], g: int | None = None) -> dict:
    """候補 s・これまでの予想 hist の局面からの最適戦略の決定木。

    ノードは {"g": 予想, "c": {判定: 子ノード}}(当たりの判定は子を持たない)。
    """
    fb = feedback_table()
    if g is None:
        if len(s) <= 2:
            g = int(s[0])
        else:
            solve_set(s, hist)
            key = _set_key(np.asarray(s, dtype=np.int64))
            g = int(_ctx()["exact"][key] & ((1 << GUESS_BITS) - 1))
    parts = fb[g, s]
    children = {}
    for r in np.unique(parts):
        if r != WIN_FEEDBACK:
            children[int(r)] = _subtree(s[parts == r], hist + [g])
    return {"g": g, "c": children}


def build_tree(found: dict[int, tuple[int, int, dict]]) -> dict:
    """solve_root の結果(1 手目の判定ごとの決定木)を、1 手目 0123 の下につなぐ。"""
    return {"g": FIRST_GUESS, "c": {r1: found[r1][2] for r1 in sorted(found)}}


def encode_tree(tree: dict) -> bytes:
    """前順に 1 ノード 6 バイト(uint16 予想, uint32 子を持つ判定のビットマスク)。app/src/cpu/tree.ts と同じ形式。"""
    out = bytearray()

    def visit(n: dict) -> None:
        mask = 0
        for r in n["c"]:
            mask |= 1 << r
        out.extend(int(n["g"]).to_bytes(2, "little"))
        out.extend(mask.to_bytes(4, "little"))
        for r in sorted(n["c"]):
            visit(n["c"][r])

    visit(tree)
    return bytes(out)


def decode_tree(data: bytes) -> dict:
    pos = 0

    def read() -> dict:
        nonlocal pos
        g = int.from_bytes(data[pos:pos + 2], "little")
        mask = int.from_bytes(data[pos + 2:pos + 6], "little")
        pos += 6
        return {"g": g, "c": {r: read() for r in range(N_FEEDBACK) if mask >> r & 1}}

    tree = read()
    if pos != len(data):
        raise ValueError("tree has trailing bytes")
    return tree


def tree_guess(tree: dict, history: list[tuple[int, int]]) -> int:
    """(予想, 判定) の列から、木をたどって次の予想を返す。"""
    node = tree
    for g, r in history:
        if node["g"] != g:
            raise ValueError("history does not follow the tree")
        node = node["c"][r]
    return node["g"]


def tree_turns(tree: dict) -> np.ndarray:
    """決定木どおりに打ったときの、秘密の数字ごとの当てるまでの回数。"""
    fb = feedback_table()
    turns = np.zeros(N_CODES, dtype=np.int64)

    def walk(n: dict, s: np.ndarray, depth: int) -> None:
        parts = fb[n["g"], s]
        for r in np.unique(parts):
            part = s[parts == r]
            if r == WIN_FEEDBACK:
                turns[part] = depth
            else:
                walk(n["c"][int(r)], part, depth + 1)

    walk(tree, np.arange(N_CODES), 1)
    return turns
