export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
}
