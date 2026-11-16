import React, { useCallback, useState } from 'react';
import { ScrollView, Text, Alert, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { exportBackup, restoreBackup, validateBackup } from '../../src/db';
import { useBudget } from '../../src/context';
import { Card, Button, s, reportError } from '../../src/ui';
const reminderId = 'budget-weekly-reminder';
export default function Settings() {
    const [enabled, setEnabled] = useState(false), [known, setKnown] = useState(false), [busy, setBusy] = useState(false);
    const { refresh } = useBudget();
    useFocusEffect(useCallback(() => { let active = true; Notifications.getAllScheduledNotificationsAsync().then(items => { if (active) {
        setEnabled(items.some(n => n.identifier === reminderId || n.content.title === 'Mój budżet'));
        setKnown(true);
    } }).catch(() => { if (active) {
        setKnown(false);
        reportError();
    } }); return () => { active = false; }; }, []));
    async function toggle() {
        setBusy(true);
        try {
            if (enabled) {
                const items = await Notifications.getAllScheduledNotificationsAsync();
                for (const n of items.filter(n => n.identifier === reminderId || n.content.title === 'Mój budżet'))
                    await Notifications.cancelScheduledNotificationAsync(n.identifier);
                setEnabled(false);
                return;
            }
            if (Platform.OS === 'android')
                await Notifications.setNotificationChannelAsync('budget-reminders', { name: 'Przypomnienia o budżecie', importance: Notifications.AndroidImportance.DEFAULT });
            const permission = await Notifications.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Brak zgody', 'Włącz powiadomienia dla aplikacji w ustawieniach telefonu.');
                return;
            }
            await Notifications.scheduleNotificationAsync({ identifier: reminderId, content: { title: 'Mój budżet', body: 'Uzupełnij wydatki z tego tygodnia.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 0, channelId: 'budget-reminders' } });
            setEnabled(true);
            Alert.alert('Ustawiono', 'Przypomnienie w niedzielę o 19:00.');
        }
        catch {
            reportError();
        }
        finally {
            setBusy(false);
        }
    }
    async function backup() { setBusy(true); try {
        if (!await Sharing.isAvailableAsync())
            throw new Error('Udostępnianie niedostępne');
        const file = new File(Paths.cache, `moj-budzet-${Date.now()}.json`);
        file.write(await exportBackup());
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Zapisz kopię budżetu' });
    }
    catch {
        reportError();
    }
    finally {
        setBusy(false);
    } }
    async function importBackup() {
        setBusy(true);
        try {
            const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
            if (picked.canceled)
                return;
            const file = new File(picked.assets[0].uri);
            if (file.size > 20000000)
                throw new Error('Plik za duży');
            const content = await file.text();
            validateBackup(content);
            Alert.alert('Przywrócić kopię?', 'Kopia zastąpi wszystkie dane budżetu. Obecny budżet zostanie dodatkowo zapisany na urządzeniu przed przywróceniem.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Przywróć', style: 'destructive', onPress: () => void restore(content) }]);
        }
        catch {
            Alert.alert('Nie można otworzyć kopii', 'Wybierz prawidłowy plik kopii utworzony w tej aplikacji.');
        }
        finally {
            setBusy(false);
        }
    }
    async function restore(content: string) { setBusy(true); try {
        new File(Paths.document, 'budzet-przed-przywroceniem.json').write(await exportBackup());
        await restoreBackup(content);
        await refresh();
        Alert.alert('Gotowe', 'Przywrócono budżet. Ustawienia powiadomień pozostają bez zmian.');
    }
    catch {
        reportError();
    }
    finally {
        setBusy(false);
    } }
    async function undoRestore() { setBusy(true); try {
        const file = new File(Paths.document, 'budzet-przed-przywroceniem.json');
        if (!file.exists) {
            Alert.alert('Brak kopii', 'Nie przywracano jeszcze kopii na tym urządzeniu.');
            return;
        }
        await restoreBackup(await file.text());
        await refresh();
        Alert.alert('Gotowe', 'Odzyskano budżet sprzed przywrócenia.');
    }
    catch {
        reportError();
    }
    finally {
        setBusy(false);
    } }
    return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.title}>Ustawienia</Text>{busy && <ActivityIndicator />}<Card><Text style={s.name}>Powiadomienia</Text><Text style={s.hint}>Przypomnienie o wpisaniu wydatków w każdą niedzielę o 19:00.</Text><Button title={known ? (enabled ? 'Wyłącz przypomnienie' : 'Włącz przypomnienie') : 'Odczytywanie przypomnienia…'} disabled={busy || !known} onPress={() => void toggle()}/></Card><Card><Text style={s.name}>Kopia zapasowa</Text><Text style={s.hint}>Zapisz plik w bezpiecznym miejscu poza telefonem. Kopia zawiera kwoty, kategorie i historię planów; nie jest zaszyfrowana.</Text><Button title="Zapisz kopię zapasową" disabled={busy} onPress={() => void backup()}/><Button title="Przywróć kopię z pliku" secondary disabled={busy} onPress={() => void importBackup()}/><Button title="Cofnij ostatnie przywrócenie" secondary disabled={busy} onPress={() => Alert.alert('Odzyskać poprzedni budżet?', 'Bieżące dane zostaną zastąpione kopią sprzed ostatniego przywrócenia.', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Odzyskaj', onPress: () => void undoRestore() }])}/></Card><Card><Text style={s.name}>Prywatność</Text><Text style={s.hint}>Kwoty i kategorie są przechowywane lokalnie na telefonie. Aplikacja nie wysyła ich na serwer. Usunięcie aplikacji może usunąć bazę danych. Regularnie zapisuj kopię zapasową.</Text></Card></ScrollView>;
}
