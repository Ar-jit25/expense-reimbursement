// Standard Company Expense Policy Thresholds per category
export const CATEGORY_POLICY_LIMITS = {
  MEALS: 75.00,          // Daily meal threshold ($75.00)
  TRAVEL: 350.00,        // Single flight/train threshold ($350.00)
  ACCOMMODATION: 250.00, // Per-night hotel threshold ($250.00)
  SUPPLIES: 100.00,      // Office supplies threshold ($100.00)
  SOFTWARE: 200.00,      // Monthly software license threshold ($200.00)
  EQUIPMENT: 500.00,     // Hardware equipment threshold ($500.00)
  OTHER: 100.00          // Other discretionary threshold ($100.00)
};

export const checkPolicyViolation = (category, amount) => {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return null;
  const limit = CATEGORY_POLICY_LIMITS[category];
  if (limit && parsed > limit) {
    return {
      limit,
      amount: parsed,
      exceededBy: (parsed - limit).toFixed(2),
      warningMessage: `Exceeds $${limit.toFixed(2)} limit by $${(parsed - limit).toFixed(2)}. Kindly document the reason in the description.`
    };
  }
  return null;
};
