import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../game/difficulty'
import { DifficultyMark, Judgement, Logo } from './marks'

export function TopScreen({ onStart }: { onStart: (d: Difficulty) => void }) {
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
        <div className="difficulty-list">
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" className="difficulty-card" onClick={() => onStart(d)}>
              <DifficultyMark difficulty={d} />
              <span className="difficulty-card__name">{DIFFICULTY_LABEL[d]}</span>
            </button>
          ))}
        </div>
      </section>

      <details className="rules">
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
