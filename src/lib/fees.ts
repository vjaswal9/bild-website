// Card-processing surcharge passed on to the buyer.
// Defaults to Stripe UAE's standard domestic card rate. Adjust here if your
// Stripe pricing differs (set both to 0 to switch surcharging off entirely).
// Note: international cards cost Stripe more (~3.9%), so on those you may
// slightly under-recover unless you raise CARD_FEE_PERCENT.
export const CARD_FEE_PERCENT: number = 2.9
export const CARD_FEE_FIXED_AED: number = 1

// Extra amount (in fils, i.e. 1/100 AED) to add on top of `subtotalAed` so the
// organiser still nets the full subtotal after Stripe deducts its fee.
// Uses the gross-up formula: charged = (subtotal + fixed) / (1 - percent).
export function cardFeeFils(subtotalAed: number): number {
  if (subtotalAed <= 0 || (CARD_FEE_PERCENT === 0 && CARD_FEE_FIXED_AED === 0)) return 0
  const subtotalFils = Math.round(subtotalAed * 100)
  const fixedFils = Math.round(CARD_FEE_FIXED_AED * 100)
  const p = CARD_FEE_PERCENT / 100
  const grossFils = Math.ceil((subtotalFils + fixedFils) / (1 - p))
  return grossFils - subtotalFils
}

// Same figure in AED (may include fils, e.g. 20.55).
export function cardFeeAed(subtotalAed: number): number {
  return cardFeeFils(subtotalAed) / 100
}
