import Database from "better-sqlite3";


const db = new Database("app.bd");
export { db };

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifiant TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        pseudo TEXT NOT NULL,
        color TEXT NOT NULL
    );
`);
