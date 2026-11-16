import * as SQLite from 'expo-sqlite';
import { Category, Expense, MonthData, emptyMonth, validExpenseDate, weeklyCents } from './domain';
let db: SQLite.SQLiteDatabase;
let initialization: Promise<void> | undefined;
export function initDb() { return initialization ??= initialize().catch(error => { initialization = undefined; throw error; }); }
async function initialize() {
    db = await SQLite.openDatabaseAsync('moj-budzet.db');
    await db.execAsync(`PRAGMA journal_mode = WAL;
 CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,plan REAL NOT NULL DEFAULT 0,frequency TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS months(key TEXT PRIMARY KEY,salary REAL NOT NULL DEFAULT 0,unplanned REAL NOT NULL DEFAULT 0,reserve REAL NOT NULL DEFAULT 0,savings REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS actuals(category_id TEXT NOT NULL,period_key TEXT NOT NULL,amount REAL NOT NULL DEFAULT 0,PRIMARY KEY(category_id,period_key));`);
    // Seed only on first database creation; never reset user edits on startup.
    const count = await db.getFirstAsync<{
        n: number;
    }>('SELECT COUNT(*) AS n FROM categories');
    const marker = await db.getFirstAsync<{
        name: string;
    }>("SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'");
    if (!marker) {
        await db.execAsync('CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
        if ((count?.n || 0) === 0) {
            await db.runAsync('INSERT INTO categories(id,name,kind,plan,frequency) VALUES(?,?,?,?,?)', 'preset-jedzenie', 'Jedzenie', 'daily', 0, 'month');
            await db.runAsync('INSERT INTO categories(id,name,kind,plan,frequency) VALUES(?,?,?,?,?)', 'preset-rachunki', 'Rachunki', 'daily', 0, 'month');
        }
    }
    const columns = await db.getAllAsync<{
        name: string;
    }>('PRAGMA table_info(categories)');
    if (!columns.some(c => c.name === 'archived'))
        await db.execAsync('ALTER TABLE categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
    await db.execAsync(`CREATE TABLE IF NOT EXISTS month_plans(period TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,plan REAL NOT NULL,frequency TEXT NOT NULL,PRIMARY KEY(period,id)); CREATE TABLE IF NOT EXISTS plan_months(period TEXT PRIMARY KEY);`);
    await db.execAsync(`CREATE TABLE IF NOT EXISTS expenses(id TEXT PRIMARY KEY,category_id TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),spent_on TEXT NOT NULL,created_at TEXT NOT NULL,note TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS expenses_category_date ON expenses(category_id,spent_on,created_at);`);
    // Preserve every known historical period before category defaults can change.
    const periods = await db.getAllAsync<{
        period: string;
    }>("SELECT key AS period FROM months UNION SELECT substr(period_key,1,7) AS period FROM actuals UNION SELECT strftime('%Y-%m',period_key,'+6 days') AS period FROM actuals WHERE length(period_key)=10");
    for (const { period } of periods)
        await ensurePlans(period);
    const moneyVersion = await db.getFirstAsync("SELECT value FROM app_meta WHERE key='money-cents'");
    if (!moneyVersion)
        await db.withExclusiveTransactionAsync(async (tx) => {
            await tx.execAsync('UPDATE categories SET plan=ROUND(plan*100);UPDATE month_plans SET plan=ROUND(plan*100);UPDATE actuals SET amount=ROUND(amount*100);UPDATE months SET salary=ROUND(salary*100),unplanned=ROUND(unplanned*100),reserve=ROUND(reserve*100),savings=ROUND(savings*100)');
            await tx.runAsync("INSERT INTO app_meta VALUES('money-cents','1')");
        });
    await ensurePlans(new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'));
}
async function ensurePlans(period: string) {
    await db.withExclusiveTransactionAsync(async (tx) => {
        const exists = await tx.getFirstAsync('SELECT period FROM plan_months WHERE period=?', period);
        if (exists)
            return;
        await tx.runAsync('INSERT INTO month_plans SELECT ?,id,name,kind,plan,frequency FROM categories WHERE archived=0', period);
        await tx.runAsync('INSERT INTO plan_months VALUES(?)', period);
    });
}
async function getMonthCategoriesImpl(period: string) { await ensurePlans(period); return (await db.getAllAsync<Category>('SELECT id,name,kind,plan,frequency FROM month_plans WHERE period=? ORDER BY rowid', period)).map(c => ({ ...c, plan: c.plan / 100 })); }
async function saveMonthCategoryImpl(period: string, c: Category) { await db.runAsync('UPDATE month_plans SET name=?,plan=?,frequency=? WHERE period=? AND id=?', c.name, Math.round(c.plan * 100), c.frequency, period, c.id); }
async function copyPlanImpl(source: string, target: string) {
    if(source===target)return;
    await ensurePlans(source);
    await ensurePlans(target);
    await db.withExclusiveTransactionAsync(async tx => {
        // Keep categories with recorded spending even when absent from the copied template.
        const retained = await tx.getAllAsync<Category>(`SELECT id,name,kind,plan,frequency FROM month_plans WHERE period=? AND id IN (
            SELECT category_id FROM expenses WHERE substr(spent_on,1,7)=?
            UNION SELECT category_id FROM actuals WHERE period_key=? OR (length(period_key)=10 AND period_key<=? AND date(period_key,'+6 days')>=?)
        )`,target,target,target,target+'-31',target+'-01');
        await tx.runAsync('DELETE FROM month_plans WHERE period=?', target);
        await tx.runAsync('INSERT INTO month_plans SELECT ?,id,name,kind,plan,frequency FROM month_plans WHERE period=?',target,source);
        for(const c of retained)await tx.runAsync('INSERT OR IGNORE INTO month_plans VALUES(?,?,?,?,?,?)',target,c.id,c.name,c.kind,c.plan,c.frequency);
        await tx.runAsync('INSERT OR IGNORE INTO plan_months VALUES(?)',target);
    });
}
async function getCategoriesImpl() { return (await db.getAllAsync<Category>('SELECT id,name,kind,plan,frequency FROM categories WHERE archived=0 ORDER BY rowid')).map(c => ({ ...c, plan: c.plan / 100 })); }
async function saveCategoryImpl(c: Category) {
    if (!c.name.trim())
        throw new Error('Wpisz nazwę kategorii');
    const duplicate = (await getCategoriesImpl()).some(existing => existing.id !== c.id && existing.kind === c.kind && existing.name.toLocaleLowerCase('pl') === c.name.trim().toLocaleLowerCase('pl'));
    if (duplicate)
        throw new Error('Ta kategoria już istnieje');
    c = { ...c, name: c.name.trim() };
    const period = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
    await ensurePlans(period);
    await db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('INSERT INTO categories(id,name,kind,plan,frequency) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,plan=excluded.plan,frequency=excluded.frequency', c.id, c.name, c.kind, Math.round(c.plan * 100), c.frequency);
        await tx.runAsync('INSERT INTO month_plans VALUES(?,?,?,?,?,?) ON CONFLICT(period,id) DO UPDATE SET name=excluded.name,plan=excluded.plan,frequency=excluded.frequency', period, c.id, c.name, c.kind, Math.round(c.plan * 100), c.frequency);
    });
}
async function deleteCategoryImpl(id: string) { await db.runAsync('UPDATE categories SET archived=1 WHERE id=?', id); }
async function getMonthImpl(key: string) { const row = await db.getFirstAsync<MonthData>('SELECT salary,unplanned,reserve,savings FROM months WHERE key=?', key); return row ? { salary: row.salary / 100, unplanned: row.unplanned / 100, reserve: row.reserve / 100, savings: row.savings / 100 } : emptyMonth(); }
async function saveMonthImpl(key: string, d: MonthData) { await db.runAsync('INSERT INTO months(key,salary,unplanned,reserve,savings) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET salary=excluded.salary,unplanned=excluded.unplanned,reserve=excluded.reserve,savings=excluded.savings', key, ...[d.salary, d.unplanned, d.reserve, d.savings].map(n => Math.round(n * 100))); }
async function getActualsImpl() { const rows = await db.getAllAsync<{
    category_id: string;
    period_key: string;
    amount: number;
}>('SELECT category_id,period_key,amount FROM actuals');
 const result=Object.fromEntries(rows.map(r => [`${r.category_id}:${r.period_key}`, r.amount / 100])) as Record<string,number>;
 const dated=await db.getAllAsync<{category_id:string;period:string;amount:number}>("SELECT category_id,substr(spent_on,1,7) AS period,SUM(amount) AS amount FROM expenses GROUP BY category_id,substr(spent_on,1,7)");
 for(const row of dated)result[`${row.category_id}:dated:${row.period}`]=row.amount/100;
 return result;
}
async function saveActualImpl(id: string, key: string, amount: number) { await db.runAsync('INSERT INTO actuals(category_id,period_key,amount) VALUES(?,?,?) ON CONFLICT(category_id,period_key) DO UPDATE SET amount=excluded.amount', id, key, Math.round(amount * 100)); }
async function saveMonthFieldImpl(period: string, field: keyof MonthData, amount: number) {
    if (!['salary', 'unplanned', 'reserve', 'savings'].includes(field))
        throw new Error('Nieznane pole');
    await db.runAsync(`INSERT INTO months(key,${field}) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET ${field}=excluded.${field}`, period, Math.round(amount * 100));
}
const backupTables = ['categories', 'months', 'actuals', 'month_plans', 'plan_months', 'expenses'] as const;
async function exportBackupImpl() {
    const tables: Record<string, unknown[]> = {};
    await db.withExclusiveTransactionAsync(async (tx) => { for (const table of backupTables)
        tables[table] = await tx.getAllAsync(`SELECT * FROM ${table}`); });
    return JSON.stringify({ format: 'moj-budzet', version: 3, createdAt: new Date().toISOString(), tables }, null, 2);
}
export function validateBackup(text: string) {
    const b = JSON.parse(text);
    if (b?.format !== 'moj-budzet' || ![2,3].includes(b.version) || !b.tables)
        throw new Error('Nieobsługiwany format kopii');
    if(b.version===2)b.tables.expenses=[];
    const schemas: Record<string, Record<string, (v: unknown) => boolean>> = {};
    const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 1000;
    const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e12 && Number.isSafeInteger(v);
    const period = (v: unknown) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
    const category = { id: str, name: str, kind: (v: unknown) => v === 'daily' || v === 'fixed', plan: amount, frequency: (v: unknown) => v === 'month' || v === 'week' };
    schemas.categories = { ...category, archived: v => v === 0 || v === 1 };
    schemas.months = { key: period, salary: amount, unplanned: amount, reserve: amount, savings: amount };
    schemas.actuals = { category_id: str, period_key: v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(v), amount };
    schemas.month_plans = { period, ...category };
    schemas.plan_months = { period };
    schemas.expenses={id:str,category_id:str,amount:v=>amount(v)&&Number(v)>0,spent_on:v=>typeof v==='string'&&validExpenseDate(v),created_at:v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v)),note:v=>typeof v==='string'&&v.length<=500};
    for (const table of backupTables) {
        const rows = b.tables[table];
        if (!Array.isArray(rows) || rows.length > 100000)
            throw new Error('Nieprawidłowa tabela');
        for (const row of rows) {
            if (!row || typeof row !== 'object' || Object.keys(row).length !== Object.keys(schemas[table]).length || Object.entries(schemas[table]).some(([key, test]) => !test(row[key])))
                throw new Error('Nieprawidłowe dane kopii');
        }
    }
    const ids = new Set(b.tables.categories.map((r: Category) => r.id));
    if (b.tables.actuals.some((r: {
        category_id: string;
    }) => !ids.has(r.category_id)) || b.tables.month_plans.some((r: Category) => !ids.has(r.id)))
        throw new Error('Brak kategorii w kopii');
    if(b.tables.expenses.some((r:{category_id:string})=>!ids.has(r.category_id)))throw new Error('Brak kategorii wydatku');
    const snapshots=new Set(b.tables.month_plans.map((r:{period:string;id:string})=>JSON.stringify([r.period,r.id])));
    if(b.tables.expenses.some((r:{category_id:string;spent_on:string})=>!snapshots.has(JSON.stringify([r.spent_on.slice(0,7),r.category_id]))))throw new Error('Brak planu dla zapisanego wydatku');
    const periods = new Set(b.tables.plan_months.map((r: {
        period: string;
    }) => r.period));
    if (b.tables.month_plans.some((r: {
        period: string;
    }) => !periods.has(r.period)))
        throw new Error('Brak miesiąca planu');
    return b.tables as Record<typeof backupTables[number], Record<string, string | number>[]>;
}
async function restoreBackupImpl(text: string) {
    const tables = validateBackup(text);
    await db.withExclusiveTransactionAsync(async (tx) => {
        for (const table of [...backupTables].reverse())
            await tx.execAsync(`DELETE FROM ${table}`);
        for (const table of backupTables)
            for (const row of tables[table]) {
                const keys = Object.keys(row);
                await tx.runAsync(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(k => row[k]));
            }
    });
}
let pending: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> { const result = pending.then(work); pending = result.catch(() => { }); return result; }
export const getMonthCategories = (...args: Parameters<typeof getMonthCategoriesImpl>) => enqueue(() => getMonthCategoriesImpl(...args));
export const saveMonthCategory = (...args: Parameters<typeof saveMonthCategoryImpl>) => enqueue(() => saveMonthCategoryImpl(...args));
export const copyPlan = (...args: Parameters<typeof copyPlanImpl>) => enqueue(() => copyPlanImpl(...args));
export const getCategories = (...args: Parameters<typeof getCategoriesImpl>) => enqueue(() => getCategoriesImpl(...args));
export const saveCategory = (...args: Parameters<typeof saveCategoryImpl>) => enqueue(() => saveCategoryImpl(...args));
export const deleteCategory = (...args: Parameters<typeof deleteCategoryImpl>) => enqueue(() => deleteCategoryImpl(...args));
export const getMonth = (...args: Parameters<typeof getMonthImpl>) => enqueue(() => getMonthImpl(...args));
export const saveMonth = (...args: Parameters<typeof saveMonthImpl>) => enqueue(() => saveMonthImpl(...args));
export const getActuals = (...args: Parameters<typeof getActualsImpl>) => enqueue(() => getActualsImpl(...args));
export const saveActual = (...args: Parameters<typeof saveActualImpl>) => enqueue(() => saveActualImpl(...args));
export const saveMonthField = (...args: Parameters<typeof saveMonthFieldImpl>) => enqueue(() => saveMonthFieldImpl(...args));
export const exportBackup = (...args: Parameters<typeof exportBackupImpl>) => enqueue(() => exportBackupImpl(...args));
export const restoreBackup = (...args: Parameters<typeof restoreBackupImpl>) => enqueue(() => restoreBackupImpl(...args));
async function editCategoryImpl(id: string, changes: Partial<Pick<Category, 'name' | 'plan' | 'frequency'>>) {
    const current = (await getCategoriesImpl()).find(c => c.id === id);
    if (!current)
        throw new Error('Kategoria została zarchiwizowana');
    await saveCategoryImpl({ ...current, ...changes });
}
export const editCategory = (...args: Parameters<typeof editCategoryImpl>) => enqueue(() => editCategoryImpl(...args));

async function addExpenseImpl(expense: Expense) {
    const cents=Math.round(expense.amount*100);
    if(!Number.isFinite(expense.amount)||cents<=0||cents>1e12||Math.abs(cents/100-expense.amount)>0.000001)throw new Error('Wpisz kwotę większą od zera, z maksymalnie dwoma miejscami po przecinku.');
    if(!validExpenseDate(expense.spentOn))throw new Error('Nieprawidłowa data wydatku.');
    if(!expense.id||expense.id.length>200||expense.note.length>500||!/^\d{4}-\d{2}-\d{2}T/.test(expense.createdAt)||!Number.isFinite(Date.parse(expense.createdAt)))throw new Error('Nieprawidłowe dane wydatku.');
    const existing=await db.getFirstAsync<{category_id:string;amount:number;spent_on:string;note:string}>('SELECT category_id,amount,spent_on,note FROM expenses WHERE id=?',expense.id);
    if(existing){if(existing.category_id!==expense.categoryId||existing.amount!==cents||existing.spent_on!==expense.spentOn||existing.note!==expense.note.trim())throw new Error('Ten wpis już istnieje.');return;}
    const category=(await getCategoriesImpl()).find(c=>c.id===expense.categoryId);
    if(!category)throw new Error('Wybierz aktywną kategorię.');
    const period=expense.spentOn.slice(0,7);
    await ensurePlans(period);
    await db.withExclusiveTransactionAsync(async tx=>{
        await tx.runAsync('INSERT OR IGNORE INTO month_plans VALUES(?,?,?,?,?,?)',period,category.id,category.name,category.kind,Math.round(category.plan*100),category.frequency);
        await tx.runAsync('INSERT INTO expenses(id,category_id,amount,spent_on,created_at,note) VALUES(?,?,?,?,?,?)',expense.id,category.id,cents,expense.spentOn,expense.createdAt,expense.note.trim());
    });
}
async function getExpenseHistoryImpl(categoryId:string,period:string){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new Error('Nieprawidłowy miesiąc');
    const [year,month]=period.split('-').map(Number);
    const entries=await db.getAllAsync<{id:string;category_id:string;amount:number;spent_on:string;created_at:string;note:string}>('SELECT * FROM expenses WHERE category_id=? AND spent_on>=? AND spent_on<=? ORDER BY spent_on DESC,created_at DESC,id DESC',categoryId,period+'-01',period+'-31');
    const previous=await db.getAllAsync<{period_key:string;amount:number}>('SELECT period_key,amount FROM actuals WHERE category_id=? ORDER BY period_key DESC',categoryId);
    const legacy=previous.map(row=>({period:row.period_key,amount:row.period_key.length===7?(row.period_key===period?row.amount/100:0):weeklyCents(row.amount/100,row.period_key,year,month-1)/100})).filter(row=>row.amount>0);
    return {entries:entries.map(row=>({id:row.id,categoryId:row.category_id,amount:row.amount/100,spentOn:row.spent_on,createdAt:row.created_at,note:row.note})) as Expense[],legacy};
}
async function deleteExpenseImpl(id:string){await db.runAsync('DELETE FROM expenses WHERE id=?',id)}
export const addExpense=(...args:Parameters<typeof addExpenseImpl>)=>enqueue(()=>addExpenseImpl(...args));
export const getExpenseHistory=(...args:Parameters<typeof getExpenseHistoryImpl>)=>enqueue(()=>getExpenseHistoryImpl(...args));
export const deleteExpense=(...args:Parameters<typeof deleteExpenseImpl>)=>enqueue(()=>deleteExpenseImpl(...args));
