export function safeFilePart(value, fallback = "file") {
  const cleaned = String(value || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function tripFilePath(tripId, userId, kind, extension, now = Date.now(), uuid = crypto.randomUUID()) {
  if (!tripId || !userId) throw new Error("ไม่พบข้อมูลทริปหรือผู้ใช้");
  return `${tripId}/${userId}/${safeFilePart(kind)}-${now}-${uuid}.${safeFilePart(extension, "jpg")}`;
}

export function chooseTrip(trips, selectedId) {
  return trips.find((trip) => trip.id === selectedId) || trips[0] || null;
}
