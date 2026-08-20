import { describe, expect, it } from "vitest";
import { chooseTrip, distanceMeters, groupNearbyLocations, safeFilePart, tripFilePath } from "./trip-utils";

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
  it("calculates distance and groups friends within 200 metres",()=>{
    const points=[{user_id:"a",latitude:13.7563,longitude:100.5018},{user_id:"b",latitude:13.7568,longitude:100.5022},{user_id:"c",latitude:13.77,longitude:100.52}];
    expect(distanceMeters(points[0],points[1])).toBeLessThan(200);
    expect(groupNearbyLocations(points,200).map((group)=>group.items.length)).toEqual([2,1]);
  });
});
