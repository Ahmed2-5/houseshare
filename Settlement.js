function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeBalances(roommates, expenses) {
  const paid = {};
  const owed = {};
  roommates.forEach((r) => {
    paid[r.id] = 0;
    owed[r.id] = 0;
  });

  for (const exp of expenses) {
    paid[exp.paid_by] = round2((paid[exp.paid_by] || 0) + exp.amount);

    if (exp.split_type === 'rent') {
      roommates.forEach((r) => {
        owed[r.id] = round2(owed[r.id] + r.rent);
      });
    } else if (exp.split_type === 'custom' && exp.custom_split) {
      const split = typeof exp.custom_split === 'string'
        ? JSON.parse(exp.custom_split)
        : exp.custom_split;
      Object.entries(split).forEach(([roommateId, share]) => {
        owed[roommateId] = round2((owed[roommateId] || 0) + Number(share));
      });
    } else {
      // equal split
      const share = exp.amount / roommates.length;
      roommates.forEach((r) => {
        owed[r.id] = round2(owed[r.id] + share);
      });
    }
  }

  const net = {};
  roommates.forEach((r) => {
    net[r.id] = round2((paid[r.id] || 0) - (owed[r.id] || 0));
  });

  return { paid, owed, net };
}

function minimizeTransactions(net, roommatesById) {
  const balances = Object.entries(net)
    .map(([id, amount]) => ({ id, amount: round2(amount) }))
    .filter((b) => Math.abs(b.amount) > 0.005);

  const creditors = balances.filter((b) => b.amount > 0).sort((a, b) => b.amount - a.amount);
  const debtors = balances.filter((b) => b.amount < 0).sort((a, b) => a.amount - b.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = round2(Math.min(-debtor.amount, creditor.amount));

    if (amount > 0.005) {
      transactions.push({
        from: debtor.id,
        fromName: roommatesById[debtor.id]?.name || debtor.id,
        to: creditor.id,
        toName: roommatesById[creditor.id]?.name || creditor.id,
        amount,
      });
    }

    debtor.amount = round2(debtor.amount + amount);
    creditor.amount = round2(creditor.amount - amount);

    if (Math.abs(debtor.amount) <= 0.005) i += 1;
    if (Math.abs(creditor.amount) <= 0.005) j += 1;
  }

  return transactions;
}

module.exports = { computeBalances, minimizeTransactions, round2 };