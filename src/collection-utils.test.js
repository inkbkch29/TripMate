import { describe, expect, it } from "vitest";
import { collectionDueStatus, filterCollections, groupCollectionsByStatus, isCollectionComplete } from "./collection-utils";

const collection = (id, due, paid = [], participants = ["a", "b"]) => ({ id, title: id, due, paid, participants, payments: {} });

describe("collection priority", () => {
  it("places the nearest unfinished due date first and undated items last", () => {
    const result = groupCollectionsByStatus([
      collection("later", "2026-10-20"), collection("undated", ""), collection("first", "2026-09-23"),
    ]);
    expect(result.active.map((item) => item.id)).toEqual(["first", "later", "undated"]);
  });

  it("moves fully paid collections into completed", () => {
    const done = collection("done", "2026-09-23", ["a", "b"]);
    const result = groupCollectionsByStatus([collection("open", "2026-09-22", ["a"]), done]);
    expect(isCollectionComplete(done)).toBe(true);
    expect(result.active.map((item) => item.id)).toEqual(["open"]);
    expect(result.completed.map((item) => item.id)).toEqual(["done"]);
  });

  it("recognizes payment status and labels overdue dates", () => {
    const paidByStatus = { ...collection("done", "2026-09-20"), payments: { a: { status: "paid" }, b: { status: "paid" } } };
    expect(isCollectionComplete(paidByStatus)).toBe(true);
    expect(collectionDueStatus(collection("late", "2026-09-20"), new Date(2026, 8, 22))).toEqual({ label: "เกินกำหนด 2 วัน", tone: "error" });
  });

  it("filters overdue, upcoming, pending, and my unpaid collections", () => {
    const today = new Date(2026, 8, 22);
    const overdue = collection("overdue", "2026-09-20");
    const soon = collection("soon", "2026-09-25");
    const later = collection("later", "2026-10-20", ["a"]);
    const pending = { ...later, id: "pending", payments: { b: { status: "pending" } } };
    const rows = [later, pending, soon, overdue];
    expect(filterCollections(rows, "overdue", "b", today).map((item) => item.id)).toEqual(["overdue"]);
    expect(filterCollections(rows, "due-soon", "b", today).map((item) => item.id)).toEqual(["soon"]);
    expect(filterCollections(rows, "pending", "b", today).map((item) => item.id)).toEqual(["pending"]);
    expect(filterCollections(rows, "mine", "b", today).map((item) => item.id)).toEqual(["later", "pending", "soon", "overdue"]);
  });
});
