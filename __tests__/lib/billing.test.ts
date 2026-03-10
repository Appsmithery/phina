jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { getDefaultBillingStatus, isPremiumActive } from "@/lib/billing";

describe("billing helpers", () => {
  it("returns an inactive default billing status", () => {
    expect(getDefaultBillingStatus()).toEqual({
      premium_active: false,
      premium_source: "none",
      premium_expires_at: null,
      host_credit_balance: 0,
    });
  });

  it("treats future-dated premium access as active", () => {
    expect(
      isPremiumActive({
        premium_active: true,
        premium_source: "apple",
        premium_expires_at: new Date(Date.now() + 60_000).toISOString(),
        host_credit_balance: 1,
      })
    ).toBe(true);
  });

  it("treats expired premium access as inactive", () => {
    expect(
      isPremiumActive({
        premium_active: true,
        premium_source: "stripe",
        premium_expires_at: new Date(Date.now() - 60_000).toISOString(),
        host_credit_balance: 0,
      })
    ).toBe(false);
  });
});
