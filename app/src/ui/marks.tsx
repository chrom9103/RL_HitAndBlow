import type { Difficulty } from '../game/difficulty'

/** シンボル「輪と点」。輪が Blow、点が Hit。 */
export function Symbol({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="56" fill="none" stroke="var(--ink)" strokeWidth="16" />
      <circle cx="112" cy="92" r="24" fill="var(--accent)" />
    </svg>
  )
}

export function Wordmark({ as: Tag = 'span', className }: { as?: 'h1' | 'span'; className?: string }) {
  return (
    <Tag className={`wordmark ${className ?? ''}`}>
      hit <em>&amp;</em> blow
    </Tag>
  )
}

export function Logo({ size = 'small' }: { size?: 'small' | 'large' }) {
  return (
    <span className={`logo logo--${size}`}>
      <Symbol size={size === 'large' ? 56 : 28} />
      <Wordmark as={size === 'large' ? 'h1' : 'span'} />
    </span>
  )
}

/** 難易度のマーク。点が輪の中心に近づくほど難しい。 */
const DOT_X: Record<Difficulty, number> = { easy: 200, normal: 164, hard: 120 }

export function DifficultyMark({ difficulty, width = 120 }: { difficulty: Difficulty; width?: number }) {
  return (
    <svg width={width} height={(width * 140) / 240} viewBox="0 0 240 140" aria-hidden="true" focusable="false">
      <circle cx="120" cy="70" r="44" fill="none" stroke="var(--ink)" strokeWidth="12" />
      <circle cx={DOT_X[difficulty]} cy="70" r="18" fill="var(--accent)" />
    </svg>
  )
}

/** 判定の表示。点 = Hit、輪 = Blow。形でも区別でき、読み上げ用の文も付ける。 */
export function Judgement({ hit, blow }: { hit: number; blow: number }) {
  const label = `${hit} Hit ${blow} Blow`
  return (
    <span className="judgement" role="img" aria-label={label} title={label}>
      {hit === 0 && blow === 0 ? (
        <span className="judgement__none" aria-hidden="true">
          —
        </span>
      ) : (
        <>
          {Array.from({ length: hit }, (_, i) => (
            <svg key={`h${i}`} className="pip" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7" fill="var(--accent)" />
            </svg>
          ))}
          {Array.from({ length: blow }, (_, i) => (
            <svg key={`b${i}`} className="pip" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="6" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
            </svg>
          ))}
        </>
      )}
      <span className="judgement__text" aria-hidden="true">
        {hit}H {blow}B
      </span>
    </span>
  )
}
