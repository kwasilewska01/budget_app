import React,{useRef,useState} from 'react';
import {ActivityIndicator,ScrollView,Text} from 'react-native';
import {exportBackup,restoreBackupWithUndo,undoLastRestore,validateBackup} from '../../src/db';
import {useBudget} from '../../src/context';
import {usePwa} from '../../src/pwa';
import {Alert} from '../../src/alert';
import {Button,Card,reportError,s} from '../../src/ui';
export default function WebSettings(){
    const [busy,setBusy]=useState(false);
    const picker=useRef<HTMLInputElement>(null);
    const {refresh}=useBudget();const pwa=usePwa();
    async function backup(){
        setBusy(true);
        try{
            const blob=new Blob([await exportBackup()],{type:'application/json'});
            const url=URL.createObjectURL(blob),link=document.createElement('a');
            link.href=url;link.download=`moj-budzet-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();
            setTimeout(()=>URL.revokeObjectURL(url),60000);
        }catch{reportError()}finally{setBusy(false)}
    }
    async function importFile(file:File){
        setBusy(true);
        try{
            if(file.size>20_000_000)throw new Error('Plik za duży');
            const content=await file.text();validateBackup(content);
            if(!window.confirm('Przywrócić kopię?\n\nZastąpi ona cały bieżący budżet. Zachowamy lokalną kopię umożliwiającą cofnięcie tej operacji.'))return;
            await restoreBackupWithUndo(content);await refresh();Alert.alert('Gotowe','Przywrócono budżet z pliku.');
        }catch{Alert.alert('Nie przywrócono kopii','Wybierz prawidłowy plik kopii aplikacji. Bieżący budżet pozostaje bez zmian.')}
        finally{setBusy(false);if(picker.current)picker.current.value=''}
    }
    async function undo(){setBusy(true);try{await undoLastRestore();await refresh();Alert.alert('Gotowe','Odzyskano budżet sprzed przywrócenia.')}catch(e){Alert.alert('Nie odzyskano budżetu',e instanceof Error?e.message:'Spróbuj ponownie.')}finally{setBusy(false)}}
    return <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Text style={s.title}>Ustawienia</Text>{busy&&<ActivityIndicator/>}
        <Card><Text style={s.name}>Aplikacja na Twoim ekranie</Text>
            <Text style={s.hint}>{pwa.installed?'Korzystasz z zainstalowanej aplikacji.':'Dodaj Mój budżet do ekranu głównego, aby otwierać go jak aplikację.'}</Text>
            {pwa.canInstall?<Button title="Zainstaluj aplikację" onPress={()=>void pwa.install()}/>:!pwa.installed?<Text style={s.hint}>iPhone: otwórz stronę w Safari → Udostępnij → Do ekranu początkowego. Android lub komputer: menu przeglądarki → Zainstaluj aplikację / Dodaj do ekranu głównego.</Text>:null}
            <Text style={s.hint}>{pwa.offlineReady?'Gotowa do pracy bez internetu.':'Przy pierwszym otwarciu pozostań chwilę online, aby przygotować pracę bez internetu.'}</Text>
            {pwa.updateAvailable&&<Button title="Zaktualizuj aplikację" onPress={()=>void pwa.applyUpdate()}/>}
        </Card>
        <Card><Text style={s.name}>Kopia zapasowa</Text><Text style={s.hint}>Pobierz plik i zachowaj go poza przeglądarką. Możesz też przywrócić kopię z aplikacji na telefonie. Plik zawiera kwoty, cele i historię wpłat; nie jest zaszyfrowany.</Text>
            <Button title="Pobierz kopię zapasową" disabled={busy} onPress={()=>void backup()}/>
            <Button title="Przywróć kopię z pliku" secondary disabled={busy} onPress={()=>picker.current?.click()}/>
            <input ref={picker} type="file" accept=".json,application/json,text/plain" aria-label="Plik kopii budżetu" style={{display:'none'}} onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file)}}/>
            <Button title="Cofnij ostatnie przywrócenie" secondary disabled={busy} onPress={()=>Alert.alert('Odzyskać poprzedni budżet?','Bieżące dane zostaną zastąpione kopią sprzed ostatniego przywrócenia.',[{text:'Anuluj',style:'cancel'},{text:'Odzyskaj',onPress:()=>void undo()}])}/>
        </Card>
        <Card><Text style={s.name}>Przechowywanie danych</Text><Text style={s.hint}>Budżet jest zapisany lokalnie w tej przeglądarce. Nie wysyłamy go na serwer. Dane z telefonu i innych przeglądarek są osobne. Wyczyszczenie danych strony lub tryb prywatny mogą usunąć budżet.</Text>
            <Text style={s.hint}>{pwa.persisted?'Przeglądarka potwierdziła trwałe przechowywanie danych. Nadal zapisuj kopie zapasowe.':'Możesz poprosić przeglądarkę o ochronę danych przed automatycznym usunięciem.'}</Text>
            {!pwa.persisted&&<Button title="Chroń lokalne dane" secondary onPress={()=>void pwa.requestPersistence()}/>}
        </Card>
        <Card><Text style={s.name}>Przypomnienia</Text><Text style={s.hint}>Cotygodniowe przypomnienia przy zamkniętej aplikacji są dostępne w wersji instalowanej na Androidzie i iPhonie. Wersja przeglądarkowa nie wysyła tych powiadomień.</Text></Card>
    </ScrollView>;
}
