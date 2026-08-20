import { describe, expect, it } from "vitest";
import { calculateBalances, simplifyDebts, splitAmount } from "./finance";

describe("finance", () => {
  it("splits cents without losing money", () => {
    expect(splitAmount(100, ["a", "b", "c"]).reduce((sum, x) => sum + x.amount, 0)).toBe(100);
  });
  it("calculates who should receive", () => {
    expect(calculateBalances([{ amount: 900, paidBy: "a", participants: ["a", "b", "c"] }], ["a", "b", "c"])).toEqual({ a: 600, b: -300, c: -300 });
  });
  it("reduces transfers", () => {
    expect(simplifyDebts({ a: 600, b: -300, c: -300 })).toEqual([
      { from: "b", to: "a", amount: 300 },
      { from: "c", to: "a", amount: 300 },
    ]);
  });
});
