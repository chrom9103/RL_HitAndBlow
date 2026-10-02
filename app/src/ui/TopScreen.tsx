import { useEffect, useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../game/difficulty'
import { DifficultyPicker } from './DifficultyPicker'
import { Judgement, Logo } from './marks'

export function TopScreen({ onStart }: { onStart: (d: Difficulty) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  // ← → で難易度を変え、Enter で始める。ボタンや「遊び方」にフォーカスがあるときはそちらに任せる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const onControl = e.target instanceof HTMLButtonElement || (e.target instanceof HTMLElement && e.target.tagName === 'SUMMARY')
      if (e.key === 'Enter' && !onControl) {
        e.preventDefault()
        onStart(difficulty)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !onControl) {
        e.preventDefault()
        const i = DIFFICULTIES.indexOf(difficulty) + (e.key === 'ArrowLeft' ? -1 : 1)
        setDifficulty(DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, i))])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [difficulty, onStart])

  return (
    <main className="top">
      <header className="top__hero">
        <Logo size="large" />
        <p className="top__lead">
          4つの数字を、相手より
          <wbr />
          少ない回数で当てよう。
        </p>
      </header>

      <section className="top__select" aria-labelledby="select-title">
        <h2 id="select-title" className="section-title">
          相手を選ぶ
        </h2>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        <button type="button" className="button button--primary start-button" onClick={() => onStart(difficulty)} aria-keyshortcuts="Enter">
          START
          <kbd className="kbd">Enter</kbd>
        </button>
      </section>

      <details className="rules" open>
        <summary>遊び方</summary>
        <ul>
          <li>秘密の数字は、0〜9 のうち重複しない 4 つの数字です。あなたと相手で共通です。</li>
          <li>交互に予想します。先攻はあなたです。</li>
          <li>
            <span className="rules__legend">
              <Judgement hit={1} blow={0} />
            </span>
            Hit … 数字も位置も合っている
          </li>
          <li>
            <span className="rules__legend">
              <Judgement hit={0} blow={1} />
            </span>
            Blow … 数字は合っているが位置が違う
          </li>
          <li>少ない回数で当てた方が勝ち。同じ回数なら引き分けです。上限はそれぞれ 10 回です。</li>
          <li>相手の予想した数字は、ゲームが終わるまで見えません。</li>
        </ul>
      </details>
    </main>
  )
}
