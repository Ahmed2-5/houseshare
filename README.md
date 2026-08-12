# HouseShare — the household ledger

HouseShare is a simple web app for roommates to track shared household
expenses — rent, utilities, internet, cleaning supplies, repairs, and more —
and automatically figure out who owes what at the end of the month.

Instead of everyone reimbursing each other transaction by transaction, the
app nets everything out and tells you the **minimum number of payments**
needed to settle up. If Marco paid the rent and internet, and Bouga paid the
electricity and water, HouseShare combines all of it into one simple answer:
*"Bouga pays Marco €X."*

## Features

- Record any shared expense: description, category, amount, date, who paid
- Three ways to split a cost:
  - **Equally** across everyone (utilities, groceries, repairs…)
  - **Fixed rent shares** — each person's set monthly rent, independent of who paid
  - **Custom** — specify exactly how much each roommate owes
- A live dashboard showing each roommate's balance for the month
- A "Settle Up" panel showing the smallest possible set of payments to zero everyone out
- Full expense history and a spending-by-category breakdown
- Editable roommate list and rent amounts

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`) — a single local file, zero setup
- **Frontend:** Plain HTML/CSS/JavaScript — no build step, no framework
- **Hosting:** deployable for free on [Render](https://render.com)

## Running it locally

```bash
npm install
npm start
```

Then open **[houseshare.com](https://houseshare.onrender.com/)**. A `houseshare.db` file is created
automatically on first run, pre-seeded with three roommates. Delete that file
to reset all data.

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for a full step-by-step guide to deploying a
free, public copy on Render.

## How the settlement math works

For a given month, the app calculates for each roommate:

- **Paid** — the total they personally paid out
- **Fair share** — what they owe based on each expense's split rule
- **Net balance** = Paid − Fair share (positive = owed money, negative = owes money)

It then greedily matches the largest debtor with the largest creditor,
repeating until every balance is zero — producing the fewest possible
transactions rather than reimbursing each expense individually.
