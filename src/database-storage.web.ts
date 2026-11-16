import * as SQLite from 'expo-sqlite';

const storeName='snapshots';
const snapshotKey='moj-budzet';
const tableNames=new Set(['categories','months','actuals','app_meta','month_plans','plan_months','expenses','goals','goal_contributions','preferences']);
type Row=Record<string,SQLite.SQLiteBindValue>;
type Snapshot={version:1;tables:{name:string;sql:string;rows:Row[]}[];indexes:string[]};
let storage:Promise<IDBDatabase>|undefined;
function getStorage(){
    return storage??=new Promise<IDBDatabase>((resolve,reject)=>{
        const request=indexedDB.open('moj-budzet-storage',1);
        request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
        request.onerror=()=>{storage=undefined;reject(request.error)};
        request.onsuccess=()=>{
            const database=request.result;
            database.onversionchange=()=>{database.close();storage=undefined};
            database.onclose=()=>{storage=undefined};
            resolve(database);
        };
    });
}
async function readSnapshot():Promise<Snapshot|undefined>{
    const storage=await getStorage();
    return new Promise((resolve,reject)=>{
        const tx=storage.transaction(storeName,'readonly');
        const request=tx.objectStore(storeName).get(snapshotKey);
        tx.oncomplete=()=>resolve(request.result);
        tx.onabort=()=>reject(tx.error||new Error('Nie odczytano lokalnego budżetu.'));
        tx.onerror=()=>{};
    });
}
async function writeSnapshot(snapshot:Snapshot){
    const storage=await getStorage();
    await new Promise<void>((resolve,reject)=>{
        const tx=storage.transaction(storeName,'readwrite');
        tx.oncomplete=()=>resolve();
        tx.onabort=()=>reject(tx.error||new Error('Nie zapisano lokalnego budżetu.'));
        tx.onerror=()=>{};
        try{tx.objectStore(storeName).put(snapshot,snapshotKey)}catch(error){tx.abort();reject(error)}
    });
}
const quote=(name:string)=>'"'+name.replace(/"/g,'""')+'"';
async function snapshotOf(database:SQLite.SQLiteDatabase):Promise<Snapshot>{
    const schema=await database.getAllAsync<{name:string;sql:string;type:string;tbl_name:string}>("SELECT name,sql,type,tbl_name FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid");
    const tables:Snapshot['tables']=[];
    for(const entry of schema.filter(entry=>entry.type==='table'&&tableNames.has(entry.name))){
        tables.push({name:entry.name,sql:entry.sql,rows:await database.getAllAsync<Row>(`SELECT * FROM ${quote(entry.name)}`)});
    }
    return {version:1,tables,indexes:schema.filter(entry=>entry.type==='index'&&tableNames.has(entry.tbl_name)).map(entry=>entry.sql)};
}
async function hydrate(snapshot:Snapshot){
    if(snapshot.version!==1||!Array.isArray(snapshot.tables))throw new Error('Nieobsługiwany format lokalnego budżetu.');
    const database=await SQLite.openDatabaseAsync(':memory:',{useNewConnection:true});
    try{
        await database.withTransactionAsync(async()=>{
            for(const table of snapshot.tables){
                if(!tableNames.has(table.name))throw new Error('Nieprawidłowa tabela budżetu.');
                await database.execAsync(table.sql);
                for(const row of table.rows){
                    const columns=Object.keys(row);
                    await database.runAsync(`INSERT INTO ${quote(table.name)}(${columns.map(quote).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,...columns.map(name=>row[name]));
                }
            }
            for(const sql of snapshot.indexes)await database.execAsync(sql);
        });
        return database;
    }catch(error){await database.closeAsync();throw error}
}
export async function openBudgetDatabase(){
    const snapshot=await readSnapshot();
    if(snapshot)return hydrate(snapshot);
    // Copy the old file-backed database once. Never delete or overwrite that source.
    const previous=await SQLite.openDatabaseAsync('moj-budzet.db');
    try{
        const migrated=await snapshotOf(previous);
        const database=await hydrate(migrated);
        try{await writeSnapshot(migrated)}catch(error){await database.closeAsync();throw error}
        return database;
    }finally{await previous.closeAsync()}
}
export async function persistBudgetDatabase(database:SQLite.SQLiteDatabase){
    await writeSnapshot(await snapshotOf(database));
}
export async function recoverBudgetDatabase(){
    const snapshot=await readSnapshot();
    if(!snapshot)throw new Error('Nie odnaleziono zapisanego budżetu.');
    return hydrate(snapshot);
}
