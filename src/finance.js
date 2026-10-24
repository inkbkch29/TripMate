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
    expenseShares(expense).forEach(({ userId, amount: share }) => {
      if (balance.hasOwnProperty(userId)) balance[userId] -= share;
    });
  });
  return Object.fromEntries(Object.entries(balance).map(([id, value]) => [id, Math.round(value * 100) / 100]));
};

// Shares returned by the database are amounts, including for percentage splits.
// Preserve those amounts instead of dividing a custom/receipt bill equally again.
export function expenseShares(expense) {
  const people = [...new Set(expense.participants || [])];
  const amounts = people.map(id => Number(expense.shares?.[id]));
  const target = Math.round(Number(expense.amount) * 100);
  if (people.length && amounts.every(value => Number.isFinite(value) && value >= 0)) {
    const rows = people.map((userId,index) => ({ userId, cents: Math.round(amounts[index]*100) }));
    const delta = target - rows.reduce((sum,row) => sum+row.cents,0);
    if (Math.abs(delta) <= 1) {
      const row = rows.find(row => row.cents > 0) || rows[0];
      row.cents += delta;
      return rows.map(row => ({userId:row.userId,amount:row.cents/100}));
    }
  }
  return splitAmount(expense.amount, people);
}

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
