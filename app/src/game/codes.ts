/** 秘密の数字・予想は、0〜9 から重複なしで選んだ 4 桁の文字列("0123" など)。 */
export const CODE_LENGTH = 4
export const MAX_TURNS = 10

export interface Judgement {
  hit: number
  blow: number
}

/** 10P4 = 5,040 通りを辞書順に列挙する(学習側の itertools.permutations と同じ順序)。 */
export const ALL_CODES: readonly string[] = (() => {
  const out: string[] = []
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 10; b++)
      for (let c = 0; c < 10; c++)
        for (let d = 0; d < 10; d++)
          if (a !== b && a !== c && a !== d && b !== c && b !== d && c !== d) out.push(`${a}${b}${c}${d}`)
  return out
})()

export function judge(secret: string, guess: string): Judgement {
  let hit = 0
  let common = 0
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) hit++
    if (secret.includes(guess[i])) common++
  }
  return { hit, blow: common - hit }
}

export function isSolved(j: Judgement): boolean {
  return j.hit === CODE_LENGTH
}

/** 入力を検証し、問題があれば日本語のエラーメッセージを返す。正しければ null。 */
export function validateGuess(input: string): string | null {
  if (!/^\d*$/.test(input)) return '数字(0〜9)だけを入力してください。'
  if (input.length !== CODE_LENGTH) return `${CODE_LENGTH}桁の数字を入力してください(いま${input.length}桁)。`
  if (new Set(input).size !== CODE_LENGTH) return '同じ数字は2回使えません。すべて違う数字にしてください。'
  return null
}

export function randomCode(rand: () => number = Math.random): string {
  return ALL_CODES[Math.floor(rand() * ALL_CODES.length)]
}
