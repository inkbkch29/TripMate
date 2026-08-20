export const splitAmount = (amount, participants) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !participants?.length) return [];
  const cents = Math.round(value * 100);
  const base = Math.floor(cents / participants.length);
  let remainder = cents - base * participants.length;
  return participants.map((userId) => ({
    userId,
    amount: (base + (remainder-- > 0 ? 1 : 0)) / 100,
  }));
};

export const calculateBalances = (expenses, memberIds) => {
  const balance = Object.fromEntries(memberIds.map((id) => [id, 0]));
  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (!balance.hasOwnProperty(expense.paidBy) || !Number.isFinite(amount)) return;
    balance[expense.paidBy] += amount;
    splitAmount(amount, expense.participants).forEach(({ userId, amount: share }) => {
      if (balance.hasOwnProperty(userId)) balance[userId] -= share;
    });
  });
  return Object.fromEntries(Object.entries(balance).map(([id, value]) => [id, Math.round(value * 100) / 100]));
};

export const simplifyDebts = (balances) => {
  const creditors = Object.entries(balances)
    .filter(([, value]) => value > 0.009)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
  const debtors = Object.entries(balances)
    .filter(([, value]) => value < -0.009)
    .map(([id, value]) => ({ id, value: -value }))
    .sort((a, b) => b.value - a.value);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].value, creditors[j].value);
    if (amount > 0.009) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amount * 100) / 100 });
    debtors[i].value -= amount;
    creditors[j].value -= amount;
    if (debtors[i].value < 0.01) i += 1;
    if (creditors[j].value < 0.01) j += 1;
  }
  return transfers;
};
