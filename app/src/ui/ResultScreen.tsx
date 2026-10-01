import { useEffect, useRef } from 'react'
import { MAX_TURNS } from '../game/codes'
import { DIFFICULTY_LABEL, type Difficulty } from '../game/difficulty'
import type { Match } from '../game/match'
import { History } from './History'
import { Logo } from './marks'

interface Props {
  difficulty: Difficulty
  match: Match
  onRetry: () => void
  onChangeDifficulty: () => void
}

const HEADLINE = { win: 'あなたの勝ち', lose: 'あなたの負け', draw: '引き分け' } as const
const MESSAGE = {
  win: 'あなたの方が少ない回数で当てました。',
  lose: 'CPU の方が少ない回数で当てました。',
  draw: '同じ回数で並びました。',
} as const

function describe(solved: boolean, turns: number) {
  if (solved) return `${turns}回で正解`
  return turns >= MAX_TURNS ? `${turns}回で当てられず` : `${turns}回(未正解)`
}

export function ResultScreen({ difficulty, match, onRetry, onChangeDifficulty }: Props) {
  const outcome = match.outcome!
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])

  const drawMessage =
    outcome.result === 'draw' && !outcome.playerSolved ? 'どちらも 10 回で当てられませんでした。' : MESSAGE[outcome.result]

  return (
    <main className="result">
      <header className="game__bar">
        <Logo />
        <span className="chip">{DIFFICULTY_LABEL[difficulty]}</span>
      </header>

      <section className={`verdict verdict--${outcome.result}`}>
        <h1 className="verdict__title" ref={headingRef} tabIndex={-1}>
          {HEADLINE[outcome.result]}
        </h1>
        <p className="verdict__message">{drawMessage}</p>
        <dl className="verdict__scores">
          <div>
            <dt>あなた</dt>
            <dd>{describe(outcome.playerSolved, outcome.playerTurns)}</dd>
          </div>
          <div>
            <dt>CPU</dt>
            <dd>{describe(outcome.cpuSolved, outcome.cpuTurns)}</dd>
          </div>
        </dl>
        <div className="secret">
          <span className="secret__label">秘密の数字</span>
          <span className="secret__code">
            {match.secret.split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </span>
        </div>
        <div className="actions">
          <button type="button" className="button button--primary" onClick={onRetry}>
            もう一度
          </button>
          <button type="button" className="button" onClick={onChangeDifficulty}>
            難易度を変える
          </button>
        </div>
      </section>

      <div className="histories histories--result">
        <History title="あなた" turns={match.player} secret={match.secret} compact />
        <History title="CPU" turns={match.cpu} secret={match.secret} compact />
      </div>
    </main>
  )
}
