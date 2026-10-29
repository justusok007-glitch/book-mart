// Weighted average cost — pure maths so it can be tested on its own.
//
// new average = (stock already held × old average + Σ qty × cost of this purchase) ÷ (stock held + qty bought)
// Negative stock (sold before it was entered) counts as 0.
// If the item has stock but no known cost (opening stock entered without cost),
// the new average is just this purchase's average.

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * @param {number} heldQty    total stock of the item (all colours) before this purchase
 * @param {number|null} oldAvg current average cost, or null if unknown
 * @param {{qty:number, unitCost:number}[]} lines  this purchase's lines for the item
 * @returns {{ avgCost:number, lastCost:number, addQty:number, addValue:number }}
 */
export function nextAverage(heldQty, oldAvg, lines) {
  const addQty = lines.reduce((s, l) => s + l.qty, 0)
  const addValue = lines.reduce((s, l) => s + l.qty * l.unitCost, 0)
  const held = Math.max(0, heldQty || 0)
  const lastCost = lines.length ? lines[lines.length - 1].unitCost : oldAvg ?? 0
  let avgCost
  if (addQty <= 0) avgCost = oldAvg ?? 0
  else if (oldAvg == null || held === 0) avgCost = addValue / addQty
  else avgCost = (held * oldAvg + addValue) / (held + addQty)
  return { avgCost: round2(avgCost), lastCost: round2(lastCost), addQty, addValue: round2(addValue) }
}
