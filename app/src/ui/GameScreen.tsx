import { useCallback, useEffect, useRef, useState } from 'react'
import { CODE_LENGTH, randomCode, validateGuess } from '../game/codes'
import { DIFFICULTY_LABEL, type Difficulty } from '../game/difficulty'
import { applyGuess, createMatch, type Match } from '../game/match'
import { createCpu, type Cpu } from '../cpu/client'
import { createHinter, type Hinter } from '../hint/client'
import type { Hint } from '../hint/minimax'
import { History } from './History'
import { Keypad } from './Keypad'
import { Logo } from './marks'

interface Props {
  difficulty: Difficulty
  /** hints: ヒントを見た手番の数 */
  onFinish: (match: Match, hints: number) => void
  onQuit: () => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** CPU の手番の「間」(0.6〜1.2 秒) */
const cpuDelay = () => 600 + Math.random() * 600

export function GameScreen({ difficulty, onFinish, onQuit }: Props) {
  const [match, setMatch] = useState<Match>(() => createMatch(randomCode()))
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState(false)
  const cpuRef = useRef<Cpu | null>(null)
  const hinterRef = useRef<Hinter | null>(null)
  /** data が null の間は計算中 */
  const [hint, setHint] = useState<{ turn: number; data: Hint | null } | null>(null)
  const [hintTurns, setHintTurns] = useState<ReadonlySet<number>>(() => new Set())

  useEffect(() => {
    const cpu = createCpu(difficulty)
    cpuRef.current = cpu
    return () => {
      cpu.dispose()
      cpuRef.current = null
    }
  }, [difficulty])

  useEffect(() => {
    const hinter = createHinter()
    hinterRef.current = hinter
    return () => {
      hinter.dispose()
      hinterRef.current = null
    }
  }, [])

  // CPU の手番
  useEffect(() => {
    if (match.next !== 'cpu') return
    let cancelled = false
    const cpu = cpuRef.current
    if (!cpu) return
    Promise.all([cpu.guess(match.cpu), sleep(cpuDelay())])
      .then(([guess]) => {
        if (!cancelled) setMatch((m) => applyGuess(m, 'cpu', guess))
      })
      .catch(() => {
        if (!cancelled) setFatal(true)
      })
    return () => {
      cancelled = true
    }
  }, [match])

  // 終了したら少し間を置いて結果へ
  useEffect(() => {
    if (!match.outcome) return
    const t = setTimeout(() => onFinish(match, hintTurns.size), 1100)
    return () => clearTimeout(t)
  }, [match, onFinish, hintTurns])

  const playerTurn = match.next === 'player'
  const turnNo = match.player.length
  // 手番が進んだら前のヒントは消える
  const shownHint = hint && hint.turn === turnNo ? hint : null

  const requestHint = useCallback(() => {
    const hinter = hinterRef.current
    if (!playerTurn || !hinter || (hint && hint.turn === turnNo)) return
    const turn = turnNo
    setHint({ turn, data: null })
    setHintTurns((s) => new Set(s).add(turn))
    hinter
      .hint(match.player)
      .then((data) => setHint((h) => (h && h.turn === turn ? { turn, data } : h)))
      .catch(() => {
        setHint((h) => (h && h.turn === turn ? null : h))
        setError('ヒントを計算できませんでした。')
      })
  }, [hint, match.player, playerTurn, turnNo])

  const fillHint = useCallback(() => {
    if (!playerTurn || !shownHint?.data) return
    setInput(shownHint.data.guess)
    setError(null)
  }, [playerTurn, shownHint])

  const addDigit = useCallback(
    (d: string) => {
      if (!playerTurn) return
      if (input.includes(d)) {
        setError(`「${d}」はもう入っています。同じ数字は2回使えません。`)
        return
      }
      if (input.length >= CODE_LENGTH) {
        setError(`${CODE_LENGTH}桁まで入力できます。「決定」で予想を送ってください。`)
        return
      }
      setInput(input + d)
      setError(null)
    },
    [input, playerTurn],
  )

  const removeDigit = useCallback(() => {
    setInput((v) => v.slice(0, -1))
    setError(null)
  }, [])

  const submit = useCallback(() => {
    if (!playerTurn) return
    const problem = validateGuess(input)
    if (problem) {
      setError(problem)
      return
    }
    if (match.player.some((t) => t.guess === input)) {
      setError('その数字はすでに予想しました。別の数字を試してください。')
      return
    }
    setMatch((m) => applyGuess(m, 'player', input))
    setInput('')
    setError(null)
  }, [input, match.player, playerTurn])

  // キーボード入力
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        addDigit(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        removeDigit()
      } else if (e.key === 'Escape') {
        setInput('')
        setError(null)
      } else if (e.key === 'Enter') {
        // ボタンにフォーカスがあるときはボタン自身の動作に任せる
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addDigit, removeDigit, submit])

  const playerSolved = match.player.some((t) => t.hit === CODE_LENGTH)
  const status = fatal
    ? '読み込みに失敗しました。ページを再読み込みしてください。'
    : match.outcome
      ? '勝負がつきました'
      : playerTurn
        ? 'あなたの番です'
        : playerSolved
          ? '正解です。CPU の同じ回の手番を待っています'
          : 'CPU の番です'

  return (
    <main className="game">
      <header className="game__bar">
        <Logo />
        <span className="chip">{DIFFICULTY_LABEL[difficulty]}</span>
        <button type="button" className="link-button" onClick={onQuit}>
          やめる
        </button>
      </header>

      <div className="scoreboard" aria-label="回数">
        <div className={`score ${playerTurn ? 'is-active' : ''}`}>
          <span className="score__who">あなた</span>
          <span className="score__count">
            <b>{match.player.length}</b>回
          </span>
        </div>
        <span className="score__sep" aria-hidden="true">
          /
        </span>
        <div className={`score ${match.next === 'cpu' ? 'is-active' : ''}`}>
          <span className="score__who">CPU</span>
          <span className="score__count">
            <b>{match.cpu.length}</b>回
          </span>
        </div>
      </div>

      <div className="game__body">
        <div className="histories">
          <History title="あなた" turns={match.player} />
          <History title="CPU" turns={match.cpu} hidden pending={match.next === 'cpu'} pendingLabel="考え中" />
        </div>

        <section className="dock" aria-label="予想の入力">
          <p className={`status ${fatal ? 'status--error' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className="hint" aria-live="polite">
            {shownHint?.data ? (
              <HintText hint={shownHint.data} onUse={playerTurn ? fillHint : undefined} />
            ) : (
              <button type="button" className="hint-button" onClick={requestHint} disabled={!playerTurn || !!shownHint}>
                {shownHint ? '計算中…' : 'ヒント'}
              </button>
            )}
          </div>
          <div className={`entry ${playerTurn ? '' : 'is-waiting'}`} aria-label={`入力中の数字: ${input || 'なし'}`}>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <span key={i} className={`entry__slot ${i === input.length && playerTurn ? 'is-cursor' : ''}`}>
                {input[i] ?? ''}
              </span>
            ))}
          </div>
          <p className="error" role="alert">
            {error && (
              <>
                <span className="error__mark" aria-hidden="true">
                  !
                </span>
                {error}
              </>
            )}
          </p>
          <Keypad value={input} disabled={!playerTurn} onDigit={addDigit} onDelete={removeDigit} onSubmit={submit} />
        </section>
      </div>
    </main>
  )
}

function HintText({ hint, onUse }: { hint: Hint; onUse?: () => void }) {
  const use = onUse && (
    <button type="button" className="link-button hint__use" onClick={onUse}>
      入力する
    </button>
  )
  if (hint.remaining === 1) {
    return (
      <p className="hint__text">
        答えは <span className="code">{hint.guess}</span> です {use}
      </p>
    )
  }
  return (
    <p className="hint__text">
      残り候補 {hint.remaining.toLocaleString()} 通り。おすすめ <span className="code">{hint.guess}</span> {use}
      <span className="hint__note">
        {hint.isCandidate
          ? `当たる可能性あり。外れても最悪で残り ${hint.worst.toLocaleString()} 通り`
          : `答えではありませんが、最悪でも残り ${hint.worst.toLocaleString()} 通りに絞れます`}
      </span>
    </p>
  )
}
