import { Judgement } from './marks'

/** 遊び方の箇条書き(トップ画面とゲーム中のインフォメーションで共通) */
export function RulesList() {
  return (
    <ul className="rules-list">
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
  )
}
