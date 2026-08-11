const express = require('express'); 
const path = require('path'); 
const db = require('./db'); 

const { computeBalances, minimizeTransactions, round2} = require('./Settlement'); 
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); 


const CATEGORIES = [
'rent', 'electricity', 'water', 'gaz', 'waste', 'internet', 'cleaning', 'maintenance', 'furniture', 'other',
];


app.get('/api/roommates' , (req,res) =>{
    const roommates = db.prepare('SELECT * FROM roommates ORDER BY id').all();
    res.json(roommates);
}); 


app.put('/api/roommates/:id', (req,res) =>{
    const {name , rent} = req.body;
    const id = Number(req.params.id); 
    const existing = db.prepare('SELECT * FROM roommates WHERE id = ?').get(id); 
    if(!existing) return res.status(404).json({ error: 'Roommate not found'}); 

    db.prepare('UPDATE roommates SET name = ? , rent = ? WHERE id = ?').run(
        name ?? existing.name, 
        rent !== undefined ? Number(rent) : existing.rent, 
        id, 
    ); 
    res.json(db.prepare('SELECT * FROM roommates WHERE id = ?').get(id));

}); 



app.post('/api/roommates', (req,res) => {
    
    const { name , rent} = req.body;
    if (!name) return res.status(400).json ({ error: 'Name is required'}); 
    const info = db.prepare('INSERT INTO roommates (name, rent)  VALUES(?,?)').run(name, Number(rent) || 0); 
    res.status(201).json(db.prepare('SELECT * FROM roommates WHEERE id = ? ').get(info.lastInsertRowid));
}); 


app.delete('/api/roommates/:id', (req,res) => {
    const id = number(req.params.id);
    const usedInExpenses = db.prepare('SELECT COUNT(*) AS c FROM exprenses WHERE paid_by= ?').get(id).c; 
    if(usedInExpenses > 0 ){
        returnres.status(400).json({ error: 'cannot remove a roommate who has recorded expenses.'});
    }

    db.prepare('DELETE FROM roommates WHERE id = ?').run(id); 
    res.status(204).end(); 
}); 


app.get('/api/expenses', (req, res) => {
  const { month } = req.query; // format YYYY-MM
  let rows;
  if (month) {
    rows = db.prepare("SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC, id DESC").all(month);
  } else {
    rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
  }
  res.json(rows.map(serializeExpense));
});
 
app.post('/api/expenses', (req, res) => {
  const {
    description, category, amount, date, paidBy, splitType, customSplit,
  } = req.body;
 
  if (!description || !amount || !date || !paidBy) {
    return res.status(400).json({ error: 'description, amount, date and paidBy are required' });
  }
  const type = splitType || 'equal';
  if (!['equal', 'rent', 'custom'].includes(type)) {
    return res.status(400).json({ error: 'splitType must be equal, rent, or custom' });
  }
  if (type === 'custom') {
    if (!customSplit || typeof customSplit !== 'object') {
      return res.status(400).json({ error: 'customSplit object is required for custom split type' });
    }
    const sum = round2(Object.values(customSplit).reduce((a, b) => a + Number(b), 0));
    if (Math.abs(sum - Number(amount)) > 0.01) {
      return res.status(400).json({ error: `Custom split must add up to the total amount (got ${sum}, expected ${amount})` });
    }
  }
 
  const info = db.prepare(`
    INSERT INTO expenses (description, category, amount, date, paid_by, split_type, custom_split)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    description,
    category || 'other',
    Number(amount),
    date,
    Number(paidBy),
    type,
    type === 'custom' ? JSON.stringify(customSplit) : null,
  );
 
  res.status(201).json(serializeExpense(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid)));
});
 
app.delete('/api/expenses/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});
  
app.get('/api/summary', (req, res) => {
  const { month } = req.query;
  const roommates = db.prepare('SELECT * FROM roommates ORDER BY id').all();
  const expenses = month
    ? db.prepare("SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ?").all(month)
    : db.prepare('SELECT * FROM expenses').all();
 
  const { paid, owed, net } = computeBalances(roommates, expenses);
  const roommatesById = Object.fromEntries(roommates.map((r) => [r.id, r]));
  const transactions = minimizeTransactions(net, roommatesById);
 
  const balances = roommates.map((r) => ({
    id: r.id,
    name: r.name,
    paid: paid[r.id] || 0,
    owed: owed[r.id] || 0,
    net: net[r.id] || 0,
  }));
 
  res.json({
    month: month || 'all-time',
    totalExpenses: round2(expenses.reduce((sum, e) => sum + e.amount, 0)),
    balances,
    transactions,
  });
});
 
app.get('/api/stats', (req, res) => {
  const { month } = req.query;
  const expenses = month
    ? db.prepare("SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ?").all(month)
    : db.prepare('SELECT * FROM expenses').all();
 
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = 0; });
  expenses.forEach((e) => {
    byCategory[e.category] = round2((byCategory[e.category] || 0) + e.amount);
  });
 
  res.json({
    month: month || 'all-time',
    total: round2(expenses.reduce((sum, e) => sum + e.amount, 0)),
    byCategory,
    count: expenses.length,
  });
});
 
app.get('/api/categories', (req, res) => res.json(CATEGORIES));
 
function serializeExpense(row) {
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amount: row.amount,
    date: row.date,
    paidBy: row.paid_by,
    splitType: row.split_type,
    customSplit: row.custom_split ? JSON.parse(row.custom_split) : null,
  };
}
 
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HouseShare running at http://localhost:${PORT}`);
});

