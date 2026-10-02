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

/** インフォメーションのマーク(丸で囲んだ i) */
export function InfoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="7.6" r="1.3" fill="currentColor" />
      <path d="M12 10.8v6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
