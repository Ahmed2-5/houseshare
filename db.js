const Database = require('better-sqlite3'); 
const path = require('path'); 

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'houseshare.db'); 
const db = new Database(DB_PATH); 
db.pragma('journal_mode = WAL'); 

db.exec(`
    CREATE TABLE IF NOT EXISTS roommates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    rent REAL NOT NULL DEFAULT 0
    ); 
    CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    description TEXT NOT NULL , 
    category TEXT , 
    amount REAL NOT NULL , 
    date TEXT NOT NULL, 
    paid_by INTEGER NOT NULL, 
    split_type TEXT NOT NULL DEFAULT 'equal', 
    custom_split TEXT, 
    created_at TEXT DEFAULT(datetime('now')),
    FOREIGN KEY (paid_by) REFERENCES roommates(id)
    ); 
    `); 



    const count = db.prepare('SELECT COUNT(*) AS c FROM roommates').get().c; 
    if(count == 0 ){
        const insert = db.prepare('INSERT INTO roommates (name , rent) VALUES (?,?)'); 
        insert.run('Marco', 360); 
        insert.run('Bouga', 340); 
        insert.run('roommate 3', 300); 
    }

    module.exports = db; 


