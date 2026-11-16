const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function load(file,overrides={}){
 const module={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',compiled)(name=>overrides[name]??require(name),module,module.exports);
 return module.exports;
}
const domain=load('src/domain.ts');
function database(){
 const raw=new DatabaseSync(':memory:');
 const adapter={execAsync:async sql=>raw.exec(sql),runAsync:async(sql,...args)=>raw.prepare(sql).run(...args),getFirstAsync:async(sql,...args)=>raw.prepare(sql).get(...args)??null,getAllAsync:async(sql,...args)=>raw.prepare(sql).all(...args),withExclusiveTransactionAsync:async work=>{raw.exec('BEGIN');try{await work(adapter);raw.exec('COMMIT')}catch(e){raw.exec('ROLLBACK');throw e}}};
 return {raw,api:load('src/db.ts',{'expo-sqlite':{openDatabaseAsync:async()=>adapter},'./domain':domain,'react-native':{Platform:{OS:'ios'}}})};
}
const c={id:'food',name:'Zakupy',kind:'daily',plan:500,frequency:'month'};
test('Kwoty z przecinkiem i walidacja',()=>{
 assert.equal(domain.numberFromInput('12,34'),12.34);assert.equal(domain.numberFromInput('12,'),12);assert.equal(domain.numberFromInput('1 200,50'),1200.5);
 for(const input of ['-1','abc','12,345','Infinity','1e2'])assert.throws(()=>domain.numberFromInput(input));
});
test('Tygodnie na granicy roku oraz luty przestępny',()=>{
 assert.equal(domain.weeksForMonth(2026,0)[0],'2025-12-29');
 assert.equal(domain.weeksForMonth(2024,1).reduce((sum,k)=>sum+domain.weekOverlap(k,2024,1),0),29);
 for(const amount of [0.01,0.02,1,100.01])assert.equal(domain.weeklyCents(amount,'2025-12-29',2025,11)+domain.weeklyCents(amount,'2025-12-29',2026,0),Math.round(amount*100));
});
test('Prognoza uwzględnia przekroczenie każdej kategorii',()=>{
 const t=domain.totals([c,{...c,id:'b'}],{salary:2000,unplanned:0,reserve:100,savings:100},{'food:2026-11-02':700},2026,10);
 assert.equal(t.remaining,1100);assert.equal(t.forecast,600);assert.equal(t.planned,1000);
});
test('Migracja istniejących danych zachowuje kwoty i plany',async()=>{
 const {raw,api}=database();
 raw.exec("CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT,kind TEXT,plan REAL,frequency TEXT);INSERT INTO categories VALUES('old','Stara','daily',123.45,'month');CREATE TABLE months(key TEXT PRIMARY KEY,salary REAL,unplanned REAL,reserve REAL,savings REAL);INSERT INTO months VALUES('2025-12',5000.12,10.01,0,0);CREATE TABLE actuals(category_id TEXT,period_key TEXT,amount REAL,PRIMARY KEY(category_id,period_key));INSERT INTO actuals VALUES('old','2025-12-29',14.01)");
 await api.initDb();assert.equal((await api.getMonth('2025-12')).salary,5000.12);assert.equal((await api.getActuals())['old:2025-12-29'],14.01);assert.equal(raw.prepare('SELECT plan FROM categories').get().plan,12345);
 await api.saveCategory({...c,id:'old',plan:900});assert.equal((await api.getMonthCategories('2025-12'))[0].plan,123.45);assert.equal((await api.getMonthCategories('2026-01'))[0].plan,123.45);
 await api.initDb();assert.equal((await api.getMonth('2025-12')).salary,5000.12);
});
test('Archiwizacja, kopia planu i równoczesny zapis pól',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);await api.getMonthCategories('2025-01');await api.saveActual('food','2025-01-06',12.34);await api.deleteCategory('food');
 assert.ok(!(await api.getCategories()).some(x=>x.id==='food'));assert.equal((await api.getActuals())['food:2025-01-06'],12.34);assert.ok((await api.getMonthCategories('2025-01')).some(x=>x.id==='food'));assert.ok(!(await api.getMonthCategories('2025-02')).some(x=>x.id==='food'));
 await api.copyPlan('2025-01','2025-02');assert.ok((await api.getMonthCategories('2025-02')).some(x=>x.id==='food'));
 await Promise.all([api.saveMonthField('2025-01','salary',1234.56),api.saveMonthField('2025-01','reserve',89.12)]);assert.deepEqual(await api.getMonth('2025-01'),{salary:1234.56,reserve:89.12,unplanned:0,savings:0});
});
test('Kopia odtwarza dane, odrzuca uszkodzenia i wycofuje nieudany import',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);await api.saveMonthField('2025-01','salary',1234.56);const backup=await api.exportBackup();
 await api.saveMonthField('2025-01','salary',1);await api.restoreBackup(backup);assert.equal((await api.getMonth('2025-01')).salary,1234.56);
 const invalid=JSON.parse(backup);invalid.tables.categories[0].plan=-10;await assert.rejects(api.restoreBackup(JSON.stringify(invalid)));assert.equal((await api.getMonth('2025-01')).salary,1234.56);
 const duplicate=JSON.parse(backup);duplicate.tables.categories.push(duplicate.tables.categories[0]);await assert.rejects(api.restoreBackup(JSON.stringify(duplicate)));assert.equal((await api.getMonth('2025-01')).salary,1234.56);
});

const expense=(id,amount,spentOn='2026-11-16')=>({id,categoryId:'food',amount,spentOn,createdAt:'2026-11-16T12:00:00.000Z',note:''});
test('Kolejne zakupy sumują się z istniejącą kwotą, bez jej nadpisywania',async()=>{
 const {raw,api}=database();await api.initDb();await api.saveCategory(c);await api.saveActual('food','2026-11-16',70);
 await Promise.all([api.addExpense(expense('a',12.34)),api.addExpense(expense('b',0.1)),api.addExpense(expense('c',0.2))]);
 const actuals=await api.getActuals();assert.equal(actuals['food:2026-11-16'],70);assert.equal(actuals['food:dated:2026-11'],12.64);assert.equal(domain.categoryTotals(c,actuals,2026,10).actual,82.64);
 assert.equal(raw.prepare('SELECT SUM(amount) AS amount FROM expenses').get().amount,1264);
 const history=await api.getExpenseHistory('food','2026-11');assert.equal(history.entries.length,3);assert.deepEqual(history.legacy,[{period:'2026-11-16',amount:70}]);
});
test('Zakupy na granicy miesięcy trafiają w całości do daty zakupu',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);
 await api.addExpense(expense('dec',10.01,'2025-12-31'));await api.addExpense(expense('jan',20.02,'2026-01-01'));
 const actuals=await api.getActuals();assert.equal(domain.categoryTotals(c,actuals,2025,11).actual,10.01);assert.equal(domain.categoryTotals(c,actuals,2026,0).actual,20.02);
 assert.deepEqual((await api.getExpenseHistory('food','2025-12')).entries.map(e=>e.id),['dec']);
 assert.deepEqual((await api.getExpenseHistory('food','2026-01')).entries.map(e=>e.id),['jan']);
 assert.ok((await api.getMonthCategories('2025-12')).some(row=>row.id==='food'));
});
test('Ponowienie zapisu nie dubluje wydatku, nieprawidłowe dane nie zmieniają bazy',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);
 await Promise.all([api.addExpense(expense('same',12.34)),api.addExpense(expense('same',12.34))]);
 assert.equal((await api.getExpenseHistory('food','2026-11')).entries.length,1);
 await assert.rejects(api.addExpense(expense('same',99)));
 for(const e of [expense('zero',0),expense('neg',-2),expense('date',3,'2026-02-30'),expense('precision',1.001),{...expense('unknown',1),categoryId:'missing'}])await assert.rejects(api.addExpense(e));
 assert.equal((await api.getExpenseHistory('food','2026-11')).entries.length,1);
 assert.equal(domain.expenseDateFromInput('29.02.2024'),'2024-02-29');assert.throws(()=>domain.expenseDateFromInput('29.02.2026'));
});
test('Historia ma daty, opisy i kolejność; usunięcie koryguje sumę',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);
 await api.addExpense({...expense('earlier',20,'2026-11-15'),note:'  Obiad  '});await api.addExpense(expense('later',30,'2026-11-16'));
 let history=await api.getExpenseHistory('food','2026-11');assert.deepEqual(history.entries.map(e=>e.id),['later','earlier']);assert.equal(history.entries[1].note,'Obiad');assert.equal(history.entries[0].createdAt,'2026-11-16T12:00:00.000Z');
 await api.deleteExpense('later');assert.equal(domain.categoryTotals(c,await api.getActuals(),2026,10).actual,20);
 await api.deleteCategory('food');history=await api.getExpenseHistory('food','2026-11');assert.equal(history.entries.length,1);await assert.rejects(api.addExpense(expense('archived',1)));
});
test('Kopia zachowuje pojedyncze zakupy i pozwala odtworzyć starszy format',async()=>{
 const {api}=database();await api.initDb();await api.saveCategory(c);await api.addExpense(expense('backup',12.34));const text=await api.exportBackup();
 assert.equal(JSON.parse(text).version,3);await api.deleteExpense('backup');await api.restoreBackup(text);assert.equal((await api.getExpenseHistory('food','2026-11')).entries.length,1);
 const invalid=JSON.parse(text);invalid.tables.expenses[0].spent_on='2026-02-30';await assert.rejects(api.restoreBackup(JSON.stringify(invalid)));assert.equal((await api.getExpenseHistory('food','2026-11')).entries.length,1);
 const old=JSON.parse(text);old.version=2;delete old.tables.expenses;await api.restoreBackup(JSON.stringify(old));assert.equal((await api.getExpenseHistory('food','2026-11')).entries.length,0);assert.ok((await api.getCategories()).some(row=>row.id==='food'));
});
test('Kopiowanie planu nie ukrywa już zapisanych zakupów',async()=>{
 const {api}=database();await api.initDb();await api.getMonthCategories('2025-01');await api.saveCategory(c);await api.addExpense(expense('keep',12.34,'2025-02-01'));
 await api.copyPlan('2025-01','2025-02');assert.ok((await api.getMonthCategories('2025-02')).some(row=>row.id==='food'));assert.equal(domain.categoryTotals(c,await api.getActuals(),2025,1).actual,12.34);
 await api.copyPlan('2025-02','2025-02');assert.ok((await api.getMonthCategories('2025-02')).some(row=>row.id==='food'));
});
