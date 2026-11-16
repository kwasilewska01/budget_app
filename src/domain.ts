export type Kind = 'daily' | 'fixed';
export type Frequency = 'month' | 'week';
export type Category = {
    id: string;
    name: string;
    kind: Kind;
    plan: number;
    frequency: Frequency;
};
export type MonthData = {
    salary: number;
    unplanned: number;
    reserve: number;
    savings: number;
};
export const PRESETS = ['Jedzenie', 'Rachunki', 'Chemia', 'Czynsz', 'Raty'];
export const emptyMonth = (): MonthData => ({ salary: 0, unplanned: 0, reserve: 0, savings: 0 });
export const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const day = (y: number, m: number, d: number) => new Date(y, m, d, 12);
export function monday(d: Date) { const x = day(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
export function weeksForMonth(y: number, m: number) { const result: string[] = []; const start = monday(day(y, m, 1)); const last = day(y, m + 1, 0); for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 7))
    result.push(dateKey(d)); return result; }
export function weekOverlap(key: string, y: number, m: number) { const [a, b, c] = key.split('-').map(Number); let count = 0; for (let i = 0; i < 7; i++) {
    const d = day(a, b - 1, c + i);
    if (d.getFullYear() === y && d.getMonth() === m)
        count++;
} return count; }
export function weekLabel(key: string) { const [y, m, d] = key.split('-').map(Number); const start = day(y, m - 1, d), end = day(y, m - 1, d + 6); const fmt = (v: Date) => `${String(v.getDate()).padStart(2, '0')}.${String(v.getMonth() + 1).padStart(2, '0')}`; return `${fmt(start)}–${fmt(end)}`; }
export const money = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
export function numberFromInput(v: string) { const normalized = v.trim().replace(/\s/g, '').replace(',', '.'); if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})?$/.test(normalized))
    throw new Error('Wpisz dodatnią kwotę z maksymalnie dwoma miejscami po przecinku'); const n = Number(normalized); if (!Number.isFinite(n) || n > 1e10)
    throw new Error('Kwota poza zakresem'); return Math.round(n * 100) / 100; }
// Split integer cents over seven days; any remainder goes to the earliest days.
// This keeps the sum across adjacent months exactly equal to the weekly amount.
export function weeklyCents(amount: number, key: string, y: number, m: number) {
    const cents = Math.round(amount * 100), base = Math.floor(cents / 7), remainder = cents % 7;
    const [year, month, date] = key.split('-').map(Number);
    let result = 0;
    for (let i = 0; i < 7; i++) {
        const d = day(year, month - 1, date + i);
        if (d.getFullYear() === y && d.getMonth() === m)
            result += base + (i < remainder ? 1 : 0);
    }
    return result;
}
export function categoryTotals(c: Category, actuals: Record<string, number>, y: number, m: number) {
    const weeks = weeksForMonth(y, m);
    const plan = c.kind === 'fixed' && c.frequency === 'week' ? weeks.reduce((sum, k) => sum + weeklyCents(c.plan, k, y, m), 0) : Math.round(c.plan * 100);
    const actual = weeks.reduce((sum, k) => sum + weeklyCents(actuals[`${c.id}:${k}`] || 0, k, y, m), 0) + Math.round((actuals[`${c.id}:${monthKey(y, m)}`] || 0) * 100) + Math.round((actuals[`${c.id}:dated:${monthKey(y,m)}`] || 0) * 100);
    return { plan: plan / 100, actual: actual / 100 };
}
export function totals(categories: Category[], data: MonthData, actuals: Record<string, number>, y: number, m: number) {
    let dailyPlan = 0, fixedPlan = 0, dailyActual = 0, fixedActual = 0, expected = 0;
    for (const c of categories) {
        const t = categoryTotals(c, actuals, y, m), plan = Math.round(t.plan * 100), actual = Math.round(t.actual * 100);
        expected += Math.max(plan, actual);
        if (c.kind === 'daily') {
            dailyPlan += plan;
            dailyActual += actual;
        }
        else {
            fixedPlan += plan;
            fixedActual += actual;
        }
    }
    const available = Math.round(data.salary * 100) - Math.round(data.unplanned * 100) - Math.round(data.reserve * 100) - Math.round(data.savings * 100);
    return { dailyPlan: dailyPlan / 100, fixedPlan: fixedPlan / 100, dailyActual: dailyActual / 100, fixedActual: fixedActual / 100, planned: (dailyPlan + fixedPlan) / 100, forecast: (available - expected) / 100, remaining: (available - dailyActual - fixedActual) / 100 };
}

export type Expense = {
    id: string;
    categoryId: string;
    amount: number;
    spentOn: string;
    createdAt: string;
    note: string;
};
function calendarDaysInMonth(year:number,month:number){
    const leap=year%4===0&&(year%100!==0||year%400===0);
    return [31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1]||0;
}
export function validExpenseDate(value:string){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [year,month,date]=value.split('-').map(Number);
    return year>=1900&&year<=9999&&month>=1&&month<=12&&date>=1&&date<=calendarDaysInMonth(year,month);
}
export function expenseDateInputError(value:string):string|null{
    const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    if(!match)return 'Wpisz pełną datę w formacie DD.MM.RRRR.';
    const date=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
    if(year<1900)return 'Wpisz rok od 1900 do 9999.';
    if(month<1||month>12)return 'Miesiąc musi być liczbą od 01 do 12.';
    if(date<1)return 'Dzień miesiąca musi być większy od zera.';
    const limit=calendarDaysInMonth(year,month);
    if(date>limit){
        const names=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
        return `${names[month-1]} ${year} ma ${limit} dni. Wybierz istniejącą datę.`;
    }
    return null;
}
export function expenseDateFromInput(value:string){
    const error=expenseDateInputError(value);
    if(error)throw new Error(error);
    const [date,month,year]=value.trim().split('.');
    return `${year}-${month}-${date}`;
}
export function expenseDateLabel(value: string) {
    const [y,m,d] = value.split('-');
    return `${d}.${m}.${y}`;
}
