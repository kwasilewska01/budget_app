import * as SQLite from 'expo-sqlite';
export function openBudgetDatabase(){return SQLite.openDatabaseAsync('moj-budzet.db')}
export async function persistBudgetDatabase(_database:SQLite.SQLiteDatabase){}
export async function recoverBudgetDatabase(){return openBudgetDatabase()}
