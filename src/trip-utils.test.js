import { describe, expect, it } from "vitest";
import { chooseTrip, safeFilePart, tripFilePath } from "./trip-utils";

describe("trip utilities", () => {
  it("creates a trip-scoped private file path", () => {
    expect(tripFilePath("trip-1", "user-2", "Collection Slip", "PNG", 10, "abc"))
      .toBe("trip-1/user-2/collection-slip-10-abc.png");
  });
  it("falls back to the first trip when a selection is unavailable", () => {
    expect(chooseTrip([{ id: "a" }, { id: "b" }], "missing")?.id).toBe("a");
    expect(chooseTrip([], "a")).toBeNull();
  });
  it("sanitizes unsafe path fragments", () => expect(safeFilePart("../../QR Code")).toBe("qr-code"));
});
