import { ALL_CODES, judge, type Judgement } from './codes'

export interface Clue extends Judgement {
  guess: string
}

/** これまでの予想と判定に矛盾しない秘密の数字の候補を返す。 */
export function filterCandidates(candidates: readonly string[], clue: Clue): string[] {
  return candidates.filter((c) => {
    const j = judge(c, clue.guess)
    return j.hit === clue.hit && j.blow === clue.blow
  })
}

export function consistentCodes(clues: readonly Clue[]): string[] {
  return clues.reduce<string[]>((cands, clue) => filterCandidates(cands, clue), ALL_CODES.slice())
}
