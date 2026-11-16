import {Alert} from '../../src/alert';
import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator} from 'react-native';
import { useBudget } from '../../src/context';
import { saveCategory, deleteCategory, editCategory } from '../../src/db';
import { Category, Kind, Frequency, PRESETS, numberFromInput } from '../../src/domain';
import { Button, Card, Field, s, reportError } from '../../src/ui';
const id = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export default function Config() {
    const { ready, categories, refresh } = useBudget();
    const [name, setName] = useState(''), [kind, setKind] = useState<Kind>('daily'), [plan, setPlan] = useState('0'), [frequency, setFrequency] = useState<Frequency>('month');
    async function add(n = name) { const clean = n.trim(); if (!clean) {
        Alert.alert('Wpisz nazwę kategorii');
        return;
    } if (categories.some(c => c.name.toLocaleLowerCase('pl') === clean.toLocaleLowerCase('pl') && c.kind === kind)) {
        Alert.alert('Ta pozycja już istnieje w wybranym typie');
        return;
    } await saveCategory({ id: id(), name: clean, kind, plan: numberFromInput(plan), frequency: kind === 'daily' ? 'month' : frequency }); await refresh(); setName(''); setPlan('0'); }
    async function edit(c: Category, changes: Partial<Category>) { if (changes.name !== undefined && !changes.name.trim())
        throw new Error('Nazwa jest wymagana'); await editCategory(c.id, changes); await refresh(); }
    if (!ready)
        return <ActivityIndicator style={{ flex: 1 }}/>;
    return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Text style={s.title}>Konfigurator</Text><Card><Text style={s.name}>Nowa pozycja</Text><Text style={s.hint}>Szybki wybór kategorii lub własna nazwa. Każda pozycja ma oddzielny plan.</Text><Text style={[s.hint, { marginTop: 14 }]}>Typ wydatku</Text><View style={s.row}>{(['daily', 'fixed'] as const).map(k => <Pressable key={k} style={[s.chip, kind === k && s.chipActive]} onPress={() => setKind(k)}><Text style={s.chipText}>{k === 'daily' ? 'Codzienne' : 'Firmowe'}</Text></Pressable>)}</View><Text style={[s.hint, { marginTop: 12 }]}>Gotowe kategorie (dotknij, aby dodać)</Text><View style={s.row}>{PRESETS.map(p => <Pressable key={p} style={s.chip} onPress={() => void add(p).catch(reportError)}><Text style={s.chipText}>＋ {p}</Text></Pressable>)}</View><Field label="Własna nazwa" keyboardType="default" placeholder="Np. Transport" value={name} commitOnBlur={false} onChangeText={setName}/><Field label={kind === 'daily' ? 'Plan miesięczny (zł)' : 'Plan pozycji (zł)'} value={plan} commitOnBlur={false} onChangeText={setPlan}/>{kind === 'fixed' && <View><Text style={[s.hint, { marginTop: 10 }]}>Częstotliwość firmowych</Text><View style={s.row}>{(['month', 'week'] as const).map(p => <Pressable key={p} style={[s.chip, frequency === p && s.chipActive]} onPress={() => setFrequency(p)}><Text style={s.chipText}>{p === 'month' ? 'Miesięcznie' : 'Tygodniowo'}</Text></Pressable>)}</View></View>}<Button title="Dodaj własną pozycję" onPress={() => void add().catch(reportError)}/></Card><Card><Text style={s.name}>Twoje pozycje</Text><Text style={s.hint}>Zmiany dotyczą bieżącego miesiąca i szablonu nowych miesięcy. Wcześniejsze plany są zachowane.</Text>{categories.map(c => <View key={c.id} style={{ borderTopWidth: 1, borderColor: '#edf0f2', marginTop: 14, paddingTop: 12 }}><Text style={s.name}>{c.name}</Text><Text style={s.hint}>{c.kind === 'daily' ? 'Codzienne · plan miesięczny' : `Firmowe · ${c.frequency === 'month' ? 'miesięcznie' : 'tygodniowo'}`}</Text><Field label="Nazwa" keyboardType="default" value={c.name} onChangeText={v => edit(c, { name: v })}/><Field label="Plan (zł)" value={String(c.plan)} onChangeText={v => edit(c, { plan: numberFromInput(v) })}/>{c.kind === 'fixed' && <View style={s.row}>{(['month', 'week'] as const).map(f => <Pressable key={f} style={[s.chip, c.frequency === f && s.chipActive]} onPress={() => void edit(c, { frequency: f }).catch(reportError)}><Text style={s.chipText}>{f === 'month' ? 'Miesięcznie' : 'Tygodniowo'}</Text></Pressable>)}</View>}<Button title="Archiwizuj pozycję" secondary onPress={() => Alert.alert('Archiwizować pozycję?', c.name + ' — historia i plany dotychczasowych miesięcy zostaną zachowane.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Archiwizuj', style: 'destructive', onPress: async () => { try {
                await deleteCategory(c.id);
                await refresh();
            }
            catch {
                reportError();
            } } }])}/></View>)}</Card></ScrollView>;
}
