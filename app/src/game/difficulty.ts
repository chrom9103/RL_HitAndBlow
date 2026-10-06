/** 難易度の選択画面に並べる難易度(Max は画面ができるまで並べない) */
export type SelectableDifficulty = 'easy' | 'normal' | 'hard'
export type Difficulty = SelectableDifficulty | 'max'

export const DIFFICULTIES: readonly SelectableDifficulty[] = ['easy', 'normal', 'hard']

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  max: 'Max',
}
