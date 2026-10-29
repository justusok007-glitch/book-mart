// Small shared pieces for item lists
import Icon from './Icon'

export function Dot({ color, size = 20 }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full border border-black/15"
      style={{ background: color, width: size, height: size }}
    />
  )
}

// stack of colour dots, or a package icon when the item has no colours
export function DotStack({ variants, max = 4 }) {
  const withDots = variants.filter((v) => v.dot)
  if (!withDots.length)
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-charcoal" aria-hidden="true">
        <Icon name="package" size={22} />
      </span>
    )
  return (
    <span className="grid h-11 w-11 shrink-0 grid-cols-2 place-items-center gap-0.5 rounded-xl bg-paper p-1" aria-hidden="true">
      {withDots.slice(0, max).map((v) => (
        <Dot key={v.id} color={v.dot} size={15} />
      ))}
    </span>
  )
}

export function StockNumber({ value, low, unit }) {
  return (
    <span className={`latin whitespace-nowrap font-bold tabular-nums ${low ? 'text-danger' : 'text-ink'}`} dir="ltr">
      {value}
      {unit && <span className="ms-1 text-sm font-normal text-muted">{unit}</span>}
    </span>
  )
}
