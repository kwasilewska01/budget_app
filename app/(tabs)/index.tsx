import {useMoney} from '../../src/context';
import {Alert} from '../../src/alert';
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator, Pressable} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useExpenses } from '../../src/expenses';
import { useBudget } from '../../src/context';
import { getMonth, getActuals, saveMonthField, getMonthCategories, copyPlan, saveMonthCategory, getMonthGoalSavings } from '../../src/db';
import { categoryTotals, Category, emptyMonth, monthKey, MonthData, numberFromInput, totals } from '../../src/domain';
import { Button, Card, Field, Metric, s, reportError } from '../../src/ui';
export default function Home() {
    const {money,unit}=useMoney();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear()), [month, setMonth] = useState(now.getMonth()), [data, setData] = useState<MonthData>(emptyMonth()), [actuals, setActuals] = useState<Record<string, number>>({});
    const periodRef = useRef(monthKey(year, month));
    periodRef.current = monthKey(year, month);
    const { ready,revision:budgetRevision } = useBudget();
    const [goalSavings,setGoalSavings]=useState(0);
    const {revision,openHistory}=useExpenses();
    const [categories, setCategories] = useState<Category[]>([]), [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
    useFocusEffect(useCallback(() => { let active = true; setLoaded(false); setFailed(false); Promise.all([getMonth(monthKey(year, month)), getActuals(), getMonthCategories(monthKey(year, month)),getMonthGoalSavings(monthKey(year,month))]).then(([d, a, c, saved]) => { if (active) {
        setGoalSavings(saved);
        setData(d);
        setActuals(a);
        setCategories(c);
        setLoaded(true);
    } }).catch(() => { if (active)
        setFailed(true); }); return () => { active = false; }; }, [year, month, retry, revision,budgetRevision]));
    async function change(k: keyof MonthData, v: string) { const amount = numberFromInput(v), period = monthKey(year, month); await saveMonthField(period, k, amount); if (periodRef.current !== period)
        return; setData(old => ({ ...old, [k]: amount })); }
    async function copyPrevious() { try {
        const period = monthKey(year, month);
        await copyPlan(monthKey(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1), monthKey(year, month));
        const copied = await getMonthCategories(period);
        if (periodRef.current === period)
            setCategories(copied);
    }
    catch {
        reportError();
    } }
    const t = totals(categories, data, actuals, year, month,goalSavings);
    if (failed)
        return <View style={s.content}><Text>Nie udało się wczytać miesiąca.</Text><Button title="Ponów" onPress={() => { setFailed(false); setRetry(n => n + 1); }}/></View>;
    if (!ready || !loaded)
        return <ActivityIndicator style={{ flex: 1 }}/>;
    return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.title}>Mój budżet</Text><Card><Text style={s.name}>{new Date(year, month, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</Text><View style={s.row}><Button title="‹ Poprzedni" secondary onPress={() => { const d = new Date(year, month - 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}/><Button title="Następny ›" secondary onPress={() => { const d = new Date(year, month + 1, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }}/></View><Field label={`Wynagrodzenie netto (${unit})`} value={String(data.salary)} onChangeText={v => change('salary', v)}/></Card><Card><Button title="Kopiuj plan z poprzedniego miesiąca" secondary onPress={() => Alert.alert('Zastąpić plan?', 'Plan wybranego miesiąca zostanie zastąpiony. Wpisane wydatki pozostaną bez zmian.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Kopiuj', onPress: () => void copyPrevious() }])}/></Card><Card><Text style={s.name}>Podsumowanie miesiąca</Text><Metric title="Saldo po wpisanych wydatkach" value={money(t.remaining)} negative={t.remaining < 0}/><Metric title="Prognoza po realizacji planu" value={money(t.forecast)} negative={t.forecast < 0} sub="Uwzględnia niewydane limity oraz przekroczenia planu."/><Metric title="Odłożone na cele w tym miesiącu" value={money(goalSavings)} sub="Wpłaty uwzględnione już w saldzie i prognozie."/><Metric title="Plan wydatków łącznie" value={money(t.planned)}/><Metric title="Codzienne — pozostało do wydania" value={money(t.dailyPlan - t.dailyActual)} sub={`Wykonano: ${money(t.dailyActual)} / ${money(t.dailyPlan)}`} negative={t.dailyActual > t.dailyPlan}/><Metric title="Firmowe — pozostało do wydania" value={money(t.fixedPlan - t.fixedActual)} sub={`Wykonano: ${money(t.fixedActual)} / ${money(t.fixedPlan)}`} negative={t.fixedActual > t.fixedPlan}/></Card><Card><Text style={s.name}>Plan wybranego miesiąca</Text><Text style={s.hint}>Edycja poniżej zmienia tylko ten miesiąc.</Text>{categories.map(c => { const ct = categoryTotals(c, actuals, year, month); return <View key={c.id} style={{ marginTop: 12 }}><Pressable accessibilityRole="button" onPress={()=>openHistory(c,monthKey(year,month))}><Text style={s.name}>{c.name} ›</Text><Text style={s.hint}>Zobacz historię wydatków</Text></Pressable><Field label={c.frequency === 'week' && c.kind === 'fixed' ? `Plan tygodniowy (${unit})` : `Plan miesięczny (${unit})`} value={String(c.plan)} onChangeText={async (v) => { const updated = { ...c, plan: numberFromInput(v) }; const period = monthKey(year, month); await saveMonthCategory(period, updated); if (periodRef.current !== period)
        return; setCategories(old => old.map(item => item.id === c.id ? updated : item)); }}/><Text style={s.hint}>{money(ct.actual)} z {money(ct.plan)}{ct.actual > ct.plan ? ' · Przekroczony plan' : ''}</Text><View accessibilityLabel={`Wykorzystanie planu ${c.name}`} style={{ height: 8, backgroundColor: '#e2e8ee', borderRadius: 4, marginTop: 6 }}><View style={{ height: 8, borderRadius: 4, width: `${ct.plan > 0 ? Math.min(100, ct.actual / ct.plan * 100) : ct.actual > 0 ? 100 : 0}%`, backgroundColor: ct.actual > ct.plan ? '#b42318' : '#177245' }}/></View></View>; })}</Card><Card><Text style={s.name}>Przelewy i pozostałe wydatki</Text><Text style={s.hint}>Wpłaty na cele są liczone automatycznie. Tutaj wpisz tylko pozostałe oszczędności.</Text>{(['unplanned', 'reserve', 'savings'] as const).map(k => <Field key={k} label={{ unplanned: 'Niezaplanowane wydatki', reserve: 'Rezerwa na urlop', savings: 'Oszczędności poza celami' }[k] + ` (${unit})`} value={String(data[k])} onChangeText={v => change(k, v)}/>)}</Card></ScrollView>;
}
