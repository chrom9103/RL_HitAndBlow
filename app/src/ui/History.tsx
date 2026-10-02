import { MAX_TURNS } from '../game/codes'
import type { Turn } from '../game/match'
import { Judgement } from './marks'

interface Props {
  title: string
  turns: readonly Turn[]
  /** 予想した数字を伏せる(判定は表示する) */
  hidden?: boolean
  /** この側の手番を待っている */
  pending?: boolean
  pendingLabel?: string
  /** 正解した行を強調する */
  secret?: string
  /** 予想した行だけを表示する(結果画面用) */
  compact?: boolean
  /** 見出しに出す回数(ゲーム中のスコア) */
  count?: number
  /** この側の手番(見出しに下線を引く) */
  active?: boolean
}

export function History({ title, turns, hidden = false, pending = false, pendingLabel, secret, compact = false, count, active = false }: Props) {
  const rows = Array.from({ length: compact ? turns.length : MAX_TURNS }, (_, i) => turns[i])
  const solvedAt = turns.findIndex((t) => t.hit === 4)
  return (
    <section className="history" aria-label={`${title}の履歴`}>
      <h2 className={`history__title ${active ? 'is-active' : ''}`}>
        <span className="history__who">{title}</span>
        {count !== undefined && (
          <span className="history__count">
            <b>{count}</b>回
          </span>
        )}
      </h2>
      <ol className="history__list">
        {rows.map((t, i) => {
          const isPending = pending && i === turns.length
          const unused = !t && !isPending
          const ended = solvedAt >= 0 && i > solvedAt
          return (
            <li
              key={i}
              className={[
                'history__row',
                unused ? 'is-empty' : '',
                ended ? 'is-ended' : '',
                i === solvedAt ? 'is-solved' : '',
                isPending ? 'is-pending' : '',
              ].join(' ')}
            >
              <span className="history__no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="visually-hidden">{i + 1}回目</span>
              {t ? (
                <>
                  {hidden ? (
                    <span className="code code--hidden" aria-label="数字は非公開">
                      {[0, 1, 2, 3].map((k) => (
                        <span key={k} className="code__slot" aria-hidden="true" />
                      ))}
                    </span>
                  ) : (
                    <span className={`code ${secret && t.guess === secret ? 'code--hit' : ''}`}>{t.guess}</span>
                  )}
                  <Judgement hit={t.hit} blow={t.blow} />
                </>
              ) : isPending ? (
                <span className="history__pending">
                  <span className="thinking" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  {pendingLabel}
                </span>
              ) : (
                <span className="history__blank" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
