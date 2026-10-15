// Card-processing surcharge passed on to the buyer.
//
// Set from what Stripe actually charged on BILD's real ticket payments (278 of
// them, October 2026), not from the published rate. The published UAE rate is
// 2.9% + 1 AED, but Stripe adds 5% VAT on its fee and some cards (international
// ones, about 3.9%) cost more, so 2.9% + 1 AED left buyers about 0.3% of ticket
// sales short and BILD absorbed the difference (about 436 AED). Averaged across
// those payments the true cost came to about 3.2% + 1.05 AED, which is what is
// used now. Re-check against the Money page if Stripe's pricing changes (set both
// to 0 to switch surcharging off entirely).
export const CARD_FEE_PERCENT: number = 3.2
export const CARD_FEE_FIXED_AED: number = 1.05

// What the surcharge was before the change above. Payments made then were
// priced with it, so working back from what was charged (see money-import.ts)
// must still recognise both.
export const LEGACY_CARD_FEE = { percent: 2.9, fixedAed: 1 } as const

// Extra amount (in fils, i.e. 1/100 AED) to add on top of `subtotalAed` so the
// organiser still nets the full subtotal after Stripe deducts its fee.
// Uses the gross-up formula: charged = (subtotal + fixed) / (1 - percent).
export function cardFeeFils(subtotalAed: number): number {
  return cardFeeFilsAt(subtotalAed, CARD_FEE_PERCENT, CARD_FEE_FIXED_AED)
}

export function cardFeeFilsAt(subtotalAed: number, percent: number, fixedAed: number): number {
  if (subtotalAed <= 0 || (percent === 0 && fixedAed === 0)) return 0
  const subtotalFils = Math.round(subtotalAed * 100)
  const fixedFils = Math.round(fixedAed * 100)
  const p = percent / 100
  const grossFils = Math.ceil((subtotalFils + fixedFils) / (1 - p))
  return grossFils - subtotalFils
}

// Same figure in AED (may include fils, e.g. 20.55).
export function cardFeeAed(subtotalAed: number): number {
  return cardFeeFils(subtotalAed) / 100
}
