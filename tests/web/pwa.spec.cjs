const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
async function openBudget(page){
    await page.goto('/');
    await expect(page.getByText('Mój budżet',{exact:true})).toBeVisible({timeout:30000});
}
async function addPurchase(page,amount,note='Zakupy testowe'){
    await page.getByLabel('Dodaj nowy wydatek',{exact:true}).click();
    await page.getByLabel('Kwota nowego wydatku',{exact:true}).fill(amount);
    await page.getByRole('button',{name:'Jedzenie',exact:true}).click();
    await page.getByLabel('Opis wydatku',{exact:true}).fill(note);
    await page.getByRole('button',{name:'Dodaj wydatek',exact:true}).click();
    await expect(page.getByLabel('Kwota nowego wydatku',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function openFood(page){
    await page.getByText('Jedzenie ›',{exact:true}).click();
    await expect(page.getByText('Łącznie w miesiącu',{exact:true})).toBeVisible();
}
test('PWA opens the budget and provides installable icons',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await openBudget(page);
    const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json()));
    expect(manifest.display).toBe('standalone');expect(manifest.icons).toHaveLength(2);
    expect(await page.evaluate(()=>crossOriginIsolated)).toBe(true);
    await page.screenshot({path:'test-results/pwa-home.png',fullPage:true});
    expect(errors).toEqual([]);
});
test('Purchases persist after reload and the app works completely offline',async({page,context})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await openBudget(page);
    await addPurchase(page,'12,34','Zakupy w poniedziałek');
    await addPurchase(page,'7,66','Drugie zakupy');
    await page.reload();await expect(page.getByText('Mój budżet',{exact:true})).toBeVisible();
    await openFood(page);await expect(page.getByText('20,00 zł',{exact:true})).toBeVisible();
    await expect(page.getByText('Zakupy w poniedziałek',{exact:true})).toBeVisible();
    await expect(page.getByText('Drugie zakupy',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Zamknij',exact:true}).click();
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await context.setOffline(true);
    await page.reload();await expect(page.getByText('Mój budżet',{exact:true})).toBeVisible();
    await expect(page.getByText('Tryb offline · wydatki zapisują się na tym urządzeniu')).toBeVisible();
    await addPurchase(page,'5,00','Zakup offline');
    await openFood(page);await expect(page.getByText('25,00 zł',{exact:true})).toBeVisible();
    await page.screenshot({path:'test-results/pwa-offline-history.png',fullPage:true});
    await page.close();
    const reopened=await context.newPage();
    await reopened.goto('/wydatki');
    await expect(reopened.getByText('Twoje wydatki',{exact:true})).toBeVisible();
    await reopened.getByRole('button',{name:/Jedzenie, 25,00 zł/}).click();
    await expect(reopened.getByText('Zakup offline',{exact:true})).toBeVisible();
    expect(errors).toEqual([]);
});
test('Browser backup downloads, restores, and can undo a restore',async({page})=>{
    page.on('dialog',dialog=>dialog.accept());
    await openBudget(page);await addPurchase(page,'10','Pierwszy zakup');
    await page.goto('/ustawienia');
    await expect(page.getByText('Aplikacja na Twoim ekranie',{exact:true})).toBeVisible();
    const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Pobierz kopię zapasową'}).click();
    const download=await waiting,backup=await fs.readFile(await download.path());
    expect(JSON.parse(backup).tables.expenses).toHaveLength(1);
    await addPurchase(page,'20','Drugi zakup');
    await page.locator('input[type=file]').setInputFiles({name:'kopia.json',mimeType:'application/json',buffer:backup});
    await expect(page.getByRole('button',{name:'Pobierz kopię zapasową'})).toBeEnabled();
    await page.goto('/');await openFood(page);await expect(page.getByText('10,00 zł',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('Drugi zakup',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Zamknij',exact:true}).click();
    await page.goto('/ustawienia');await page.getByRole('button',{name:'Cofnij ostatnie przywrócenie'}).click();
    await expect(page.getByRole('button',{name:'Pobierz kopię zapasową'})).toBeEnabled();
    await page.goto('/');await openFood(page);await expect(page.getByText('30,00 zł',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Usuń wydatek 20,00 zł',exact:false}).click();
    await expect(page.getByText('30,00 zł',{exact:true})).toHaveCount(0);
    await expect(page.getByText('10,00 zł',{exact:true}).first()).toBeVisible();
});
test('Desktop settings explain local storage and notification limits',async({page})=>{
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/ustawienia');
    await expect(page.getByRole('button',{name:'Pobierz kopię zapasową'})).toBeVisible();
    await expect(page.getByText('Odczytywanie przypomnienia…')).toHaveCount(0);
    await expect(page.getByText(/Wersja przeglądarkowa nie wysyła tych powiadomień/)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/pwa-desktop-settings.png',fullPage:true});
});

test('A second tab explains the storage lock and can retry after the first tab closes',async({page,context})=>{
    await openBudget(page);await addPurchase(page,'4,25','Zapis przed drugą kartą');
    const other=await context.newPage();await other.goto('/');
    await expect(other.getByText('Budżet jest otwarty w innej karcie lub oknie. Zamknij je i spróbuj ponownie.')).toBeVisible();
    await page.close();await other.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
    await expect(other.getByText('Mój budżet',{exact:true})).toBeVisible();
    await openFood(other);await expect(other.getByText('Zapis przed drugą kartą',{exact:true})).toBeVisible();
});

test('Zero amounts clear on focus, empty fields restore zero, and names stay unchanged',async({page})=>{
    await openBudget(page);
    const salary=page.getByLabel('Wynagrodzenie netto (zł)',{exact:true});
    await expect(salary).toHaveValue('0');await salary.focus();await expect(salary).toHaveValue('');
    await salary.blur();await expect(salary).toHaveValue('0');
    await salary.focus();await salary.pressSequentially('1234,56');await salary.blur();
    await expect(salary).toHaveValue('1234.56');await salary.focus();await expect(salary).toHaveValue('1234.56');await salary.blur();
    await page.goto('/konfigurator');const plan=page.getByLabel('Plan miesięczny (zł)',{exact:true});
    await plan.focus();await expect(plan).toHaveValue('');await plan.blur();await expect(plan).toHaveValue('0');
    const name=page.getByLabel('Własna nazwa',{exact:true});await name.fill('0');await name.blur();await name.focus();await expect(name).toHaveValue('0');
});

test('Saving still works after the browser closes every OPFS access handle',async({page})=>{
    const dialogs=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());console.log('Unexpected save dialog:',dialog.message());await dialog.dismiss()});
    const instrumented=[];
    page.on('worker',worker=>instrumented.push(worker.evaluate(()=>{
        globalThis.testHandles=[];
        const create=FileSystemFileHandle.prototype.createSyncAccessHandle;
        FileSystemFileHandle.prototype.createSyncAccessHandle=async function(...args){const handle=await create.apply(this,args);globalThis.testHandles.push(handle);return handle};
    })));
    await openBudget(page);await Promise.all(instrumented);
    await addPurchase(page,'12,34','Przed zamknięciem uchwytów');
    const worker=page.workers()[0];
    expect(await worker.evaluate(()=>globalThis.testHandles.length)).toBeGreaterThan(0);
    await worker.evaluate(()=>{for(const handle of globalThis.testHandles)try{handle.close()}catch{}});
    await addPurchase(page,'7,66','Po zamknięciu uchwytów');
    await expect(page.getByText('20,00 zł z 0,00 zł · Przekroczony plan',{exact:true})).toBeVisible();
    const salary=page.getByLabel('Wynagrodzenie netto (zł)',{exact:true});
    await salary.click();await expect(salary).toBeFocused();await expect(salary).toHaveValue('');await salary.pressSequentially('1000');await expect(salary).toHaveValue('1000');await salary.blur();await expect(salary).toHaveValue('1000');
    await expect(page.getByText('980,00 zł',{exact:true}).first()).toBeVisible();
    await page.reload();await expect(salary).toHaveValue('1000');await openFood(page);
    await expect(page.getByText('20,00 zł',{exact:true})).toBeVisible();
    await expect(page.getByText('Po zamknięciu uchwytów',{exact:true})).toBeVisible();
    expect(dialogs).toEqual([]);
});

test('Failed durable writes leave no phantom purchase and a retry saves exactly once',async({page})=>{
    await openBudget(page);await addPurchase(page,'10','Pierwszy zapis');
    await page.getByLabel('Dodaj nowy wydatek',{exact:true}).click();
    await page.getByLabel('Kwota nowego wydatku',{exact:true}).fill('20');
    await page.getByRole('button',{name:'Jedzenie',exact:true}).click();
    await page.evaluate(()=>{
        const put=IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put=function(...args){
            if(this.name==='snapshots'){IDBObjectStore.prototype.put=put;throw new DOMException('Test: brak miejsca na zapis','QuotaExceededError')}
            return put.apply(this,args);
        };
    });
    await page.getByRole('button',{name:'Dodaj wydatek',exact:true}).click();
    await expect(page.getByText('Test: brak miejsca na zapis',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Dodaj wydatek',exact:true}).click();
    await expect(page.getByLabel('Kwota nowego wydatku',{exact:true})).toHaveCount(0);
    await page.reload();await openFood(page);
    await expect(page.getByText('30,00 zł',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:/Usuń wydatek/})).toHaveCount(2);
});

test('Existing file-backed budgets are migrated without changing money or purchase history',async({page})=>{
    await page.addInitScript(()=>{
        const send=Worker.prototype.postMessage;let legacyId=null,seeded=false;
        Worker.prototype.postMessage=function(message,...args){
            if(message.type==='open'&&message.data.databasePath.endsWith('moj-budzet.db'))legacyId=message.data.nativeDatabaseId;
            if(message.type==='prepare'&&message.data.nativeDatabaseId===legacyId&&!seeded){
                seeded=true;
                const sql=`CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,plan REAL NOT NULL DEFAULT 0,frequency TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0);
                INSERT INTO categories VALUES('preset-jedzenie','Jedzenie','daily',10000,'month',0);
                CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO app_meta VALUES('money-cents','1');
                CREATE TABLE months(key TEXT PRIMARY KEY,salary REAL NOT NULL DEFAULT 0,unplanned REAL NOT NULL DEFAULT 0,reserve REAL NOT NULL DEFAULT 0,savings REAL NOT NULL DEFAULT 0);
                INSERT INTO months VALUES(strftime('%Y-%m','now','localtime'),500000,0,0,0);
                CREATE TABLE expenses(id TEXT PRIMARY KEY,category_id TEXT NOT NULL,amount INTEGER NOT NULL,spent_on TEXT NOT NULL,created_at TEXT NOT NULL,note TEXT NOT NULL DEFAULT '');
                INSERT INTO expenses VALUES('old-purchase','preset-jedzenie',1575,date('now','localtime'),'2026-11-16T10:00:00.000Z','Dawny zakup');`;
                const listener=event=>{if(event.data.id!==-1000)return;this.removeEventListener('message',listener);send.call(this,message,...args)};
                this.addEventListener('message',listener);
                send.call(this,{id:-1000,type:'exec',isSync:false,data:{nativeDatabaseId:legacyId,source:sql}});
                return;
            }
            return send.call(this,message,...args);
        };
    });
    await openBudget(page);await expect(page.getByLabel('Wynagrodzenie netto (zł)',{exact:true})).toHaveValue('5000');
    await openFood(page);await expect(page.getByText('Dawny zakup',{exact:true})).toBeVisible();
    await expect(page.getByText('15,75 zł',{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'Zamknij',exact:true}).click();await addPurchase(page,'1,25','Po migracji');
    await page.reload();await openFood(page);await expect(page.getByText('17,00 zł',{exact:true})).toBeVisible();
    await expect(page.getByText('Dawny zakup',{exact:true})).toBeVisible();
});
