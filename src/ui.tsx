import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
export const colors = { ink: '#182b3b', muted: '#64748b', bg: '#f4f6f8', blue: '#1e587e', green: '#177245', red: '#b42318' };
export function Card({ children }: {
    children: React.ReactNode;
}) { return <View style={s.card}>{children}</View>; }
export function Label({ children }: {
    children: React.ReactNode;
}) { return <Text style={s.label}>{children}</Text>; }
export function Field({ label, value, onChangeText, keyboardType = 'decimal-pad', placeholder, commitOnBlur = true }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void | Promise<void>;
    keyboardType?: 'decimal-pad' | 'default';
    placeholder?: string;
    commitOnBlur?: boolean;
}) {
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const focused = useRef(false);
    const inFlight = useRef(false);
    const lastSaved = useRef(value);
    const commitLatest = useRef<() => Promise<void>>(async () => {});
    useEffect(() => {
        if (!focused.current || !commitOnBlur) setDraft(value);
        lastSaved.current = value;
    }, [value, commitOnBlur]);
    async function commit() {
        focused.current = false;
        if (!commitOnBlur || inFlight.current || draft === lastSaved.current) return;
        inFlight.current = true;
        setSaving(true);
        try {
            await onChangeText(draft);
            lastSaved.current = draft;
        } catch (error) {
            Alert.alert('Nie zapisano zmian', error instanceof Error ? error.message : 'Spróbuj ponownie.', [
                { text: 'Anuluj', onPress: () => setDraft(value) },
                { text: 'Ponów', onPress: () => void commit() },
            ]);
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }
    commitLatest.current = commit;
    useFocusEffect(useCallback(() => () => { void commitLatest.current(); }, []));
    // Persist the old field when changing a month/week removes it from the screen.
    useEffect(() => () => { void commitLatest.current(); }, []);
    return (
        <View style={{ marginTop: 10 }}>
            <Label>{label}</Label>
            <TextInput
                accessibilityLabel={label}
                editable={!saving}
                style={s.input}
                keyboardType={keyboardType}
                placeholder={placeholder}
                value={draft}
                onFocus={() => { focused.current = true; }}
                onChangeText={text => { setDraft(text); if (!commitOnBlur) void onChangeText(text); }}
                onBlur={() => { focused.current = false; void commit(); }}
            />
            {saving && <Text style={s.hint}>Zapisywanie…</Text>}
        </View>
    );
}

export function reportError() { Alert.alert('Operacja nie powiodła się', 'Spróbuj ponownie. Twoje zapisane dane pozostają w bazie.'); }
export function Button({ title, onPress, secondary = false, disabled = false }: {
    title: string;
    onPress: () => void;
    secondary?: boolean;
    disabled?: boolean;
}) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: colors.ink }]}>{title}</Text></Pressable>; }
export function Metric({ title, value, sub, negative = false }: {
    title: string;
    value: string;
    sub?: string;
    negative?: boolean;
}) { return <View style={[s.metric, { backgroundColor: negative ? '#fff0ee' : '#e9f6ee' }]}><Label>{title}</Label><Text style={[s.amount, { color: negative ? colors.red : colors.green }]}>{value}</Text>{sub ? <Text style={s.label}>{sub}</Text> : null}</View>; }
export const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, paddingBottom: 80 }, title: { fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 14 }, card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 14, borderColor: '#e2e8ee', borderWidth: 1 }, label: { color: colors.muted, fontSize: 13, marginBottom: 4 }, input: { borderWidth: 1, borderColor: '#cbd5de', backgroundColor: 'white', borderRadius: 10, padding: 12, fontSize: 16, color: colors.ink }, button: { backgroundColor: colors.blue, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', marginTop: 10 }, secondary: { backgroundColor: '#edf2f6' }, buttonText: { color: 'white', fontWeight: '700' }, metric: { padding: 14, borderRadius: 12, marginTop: 8 }, amount: { fontSize: 23, fontWeight: '800', marginTop: 3 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }, chip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20, backgroundColor: '#edf2f6', marginBottom: 6 }, chipActive: { backgroundColor: '#cde6f8' }, chipText: { color: colors.ink, fontWeight: '600' }, name: { fontSize: 16, fontWeight: '700', color: colors.ink }, hint: { fontSize: 13, color: colors.muted, marginTop: 5 } });
