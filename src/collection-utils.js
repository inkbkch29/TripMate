const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCollectionComplete(collection) {
  const participants = collection?.participants || [];
  if (!participants.length) return false;
  const paid = new Set(collection?.paid || []);
  return participants.every((userId) => paid.has(userId) || collection?.payments?.[userId]?.status === "paid");
}

function dueTime(collection, fallback) {
  if (!DATE_PATTERN.test(collection?.due || "")) return fallback;
  const value = new Date(`${collection.due}T00:00:00`).getTime();
  return Number.isFinite(value) ? value : fallback;
}

export function groupCollectionsByStatus(collections) {
  const active = [];
  const completed = [];
  for (const collection of collections || []) {
    (isCollectionComplete(collection) ? completed : active).push(collection);
  }
  active.sort((a, b) => dueTime(a, Number.POSITIVE_INFINITY) - dueTime(b, Number.POSITIVE_INFINITY) || String(a.title || "").localeCompare(String(b.title || ""), "th"));
  completed.sort((a, b) => dueTime(b, Number.NEGATIVE_INFINITY) - dueTime(a, Number.NEGATIVE_INFINITY) || String(a.title || "").localeCompare(String(b.title || ""), "th"));
  return { active, completed };
}

export function collectionDueStatus(collection, today = new Date()) {
  if (isCollectionComplete(collection)) return { label: "ชำระครบแล้ว", tone: "success" };
  if (!DATE_PATTERN.test(collection?.due || "")) return { label: "ไม่ระบุวันครบกำหนด", tone: "default" };
  const due = new Date(`${collection.due}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due - start) / 86400000);
  if (days < 0) return { label: `เกินกำหนด ${Math.abs(days)} วัน`, tone: "error" };
  if (days === 0) return { label: "ครบกำหนดวันนี้", tone: "warning" };
  if (days === 1) return { label: "ครบกำหนดพรุ่งนี้", tone: "warning" };
  return { label: `ครบกำหนด ${collection.due}`, tone: "warning" };
}
