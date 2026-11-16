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
