import {clearZeroOnFocus} from './number-input';
import {Alert} from './alert';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {addExpense, deleteExpense, getExpenseHistory} from './db';
import {useBudget} from './context';
import {Category, dateKey, Expense, expenseDateFromInput, expenseDateLabel, money, numberFromInput, weekLabel} from './domain';
import {Button, colors, s} from './ui';

type HistoryRequest = {category: Category; period: string};
type ExpenseActions = {revision: number; openAdd: (categoryId?: string) => void; openHistory: (category: Category, period: string) => void};
const Context = createContext<ExpenseActions | null>(null);
export function useExpenses() {
    const value = useContext(Context);
    if (!value) throw new Error('Brak kontekstu wydatków');
    return value;
}
const newId = () => `expense-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
function BottomSheet({visible, title, onClose, children}: {visible: boolean; title: string; onClose: () => void; children: React.ReactNode}) {
    const insets = useSafeAreaInsets();
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij panel" style={StyleSheet.absoluteFill} onPress={onClose}/>
            <View accessibilityViewIsModal style={[styles.sheet, {paddingBottom: Math.max(16,insets.bottom)}]}>
                <View style={styles.handle}/>
                <View style={styles.heading}><Text accessibilityRole="header" style={[s.title,{flex:1,marginBottom:0}]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Zamknij" hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
                {children}
            </View>
        </KeyboardAvoidingView>
    </Modal>;
}
export function ExpenseProvider({children}: {children: React.ReactNode}) {
    const {categories} = useBudget();
    const insets=useSafeAreaInsets();
    const [notice,setNotice]=useState('');
    useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer)},[notice]);
    const [revision,setRevision] = useState(0);
    const [composer,setComposer] = useState(false);
    const [categoryId,setCategoryId] = useState('');
    const [amount,setAmount] = useState('');
    const [date,setDate] = useState('');
    const [note,setNote] = useState('');
    const [error,setError] = useState('');
    const [busy,setBusy] = useState(false);
    const saving = useRef(false);
    const requestId = useRef('');
    const [history,setHistory] = useState<HistoryRequest | null>(null);
    const [result,setResult] = useState<Awaited<ReturnType<typeof getExpenseHistory>> | null>(null);
    const [historyError,setHistoryError] = useState(false);
    const [retry,setRetry] = useState(0);
    const [deleting,setDeleting] = useState<string | null>(null);
    const deletingRef = useRef(false);
    function openAdd(selected?: string) {
        if(selected && !categories.some(c=>c.id===selected)) {Alert.alert('Kategoria zarchiwizowana','Dodaj wydatek do jednej z aktywnych kategorii przyciskiem ＋ w dolnym menu.');return;}
        setCategoryId(selected || categories[0]?.id || '');setAmount('');setNote('');setError('');setDate(expenseDateLabel(dateKey(new Date())));requestId.current=newId();setHistory(null);setComposer(true);
    }
    function closeComposer() {if(saving.current)return;setComposer(false);}
    async function save() {
        if(saving.current)return;
        saving.current=true;setBusy(true);setError('');
        try {
            const value=numberFromInput(amount);
            if(value<=0)throw new Error('Wpisz kwotę większą od zera.');
            if(!categoryId)throw new Error('Wybierz kategorię.');
            await addExpense({id:requestId.current,categoryId,amount:value,spentOn:expenseDateFromInput(date),createdAt:new Date().toISOString(),note});
            setRevision(n=>n+1);setComposer(false);setNotice(`Dodano ${money(value)} · ${expenseDateLabel(expenseDateFromInput(date))}`);
        } catch(e) {setError(e instanceof Error?e.message:'Nie zapisano wydatku. Spróbuj ponownie.');}
        finally {saving.current=false;setBusy(false);}
    }
    useEffect(()=>{
        if(!history)return;
        let active=true;setResult(null);setHistoryError(false);
        getExpenseHistory(history.category.id,history.period).then(data=>{if(active)setResult(data)}).catch(()=>{if(active)setHistoryError(true)});
        return()=>{active=false};
    },[history,revision,retry]);
    const openHistory=useCallback((category:Category,period:string)=>{setHistory({category,period})},[]);
    async function remove(expense:Expense) {
        if(deletingRef.current)return;
        deletingRef.current=true;setDeleting(expense.id);
        try {await deleteExpense(expense.id);setRevision(n=>n+1)}
        catch {Alert.alert('Nie usunięto wydatku','Spróbuj ponownie.');}
        finally {deletingRef.current=false;setDeleting(null);}
    }
    const total=result?(result.entries.reduce((sum,e)=>sum+Math.round(e.amount*100),0)+result.legacy.reduce((sum,e)=>sum+Math.round(e.amount*100),0))/100:0;
    const [year,month]=history?.period.split('-').map(Number) || [];
    return <Context.Provider value={{revision,openAdd,openHistory}}>
        {children}
        {notice?<View pointerEvents="none" accessibilityRole="alert" style={[styles.notice,{top:insets.top+10}]}><Text style={{color:'white',fontWeight:'700'}}>{notice}</Text></View>:null}
        <BottomSheet visible={composer||!!history} title={composer?'Dodaj wydatek':history?.category.name || 'Historia wydatków'} onClose={()=>{if(composer)closeComposer();else if(!deletingRef.current)setHistory(null)}}>
            {composer?<ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:12}}>
                {categories.length===0?<Text style={s.hint}>Najpierw dodaj kategorię w Konfiguratorze.</Text>:<>
                    <Text style={s.label}>Kwota (zł)</Text>
                    <TextInput autoFocus accessibilityLabel="Kwota nowego wydatku" value={amount} onChangeText={setAmount} onFocus={()=>setAmount(clearZeroOnFocus)} keyboardType="decimal-pad" placeholder="0,00" editable={!busy} style={[s.input,styles.amountInput]}/>
                    <Text style={[s.label,{marginTop:18}]}>Kategoria</Text>
                    <View style={s.row}>{categories.map(c=><Pressable accessibilityRole="button" accessibilityState={{selected:categoryId===c.id}} disabled={busy} key={c.id} onPress={()=>setCategoryId(c.id)} style={[s.chip,categoryId===c.id&&s.chipActive]}><Text style={s.chipText}>{c.name}{c.kind==='fixed'?' · firmowe':''}</Text></Pressable>)}</View>
                    <Text style={[s.label,{marginTop:12}]}>Data wydatku</Text>
                    <TextInput accessibilityLabel="Data wydatku" value={date} onChangeText={setDate} placeholder="DD.MM.RRRR" maxLength={10} editable={!busy} style={s.input}/>
                    <View style={s.row}>{[0,1].map(offset=><Button key={offset} title={offset===0?'Dzisiaj':'Wczoraj'} secondary disabled={busy} onPress={()=>{const d=new Date();d.setDate(d.getDate()-offset);setDate(expenseDateLabel(dateKey(d)))}}/>)}</View>
                    <Text style={[s.label,{marginTop:16}]}>Opis (opcjonalnie)</Text>
                    <TextInput accessibilityLabel="Opis wydatku" value={note} onChangeText={setNote} placeholder="Np. zakupy na obiad" maxLength={500} editable={!busy} style={s.input}/>
                    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
                    <Button title={busy?'Zapisywanie…':'Dodaj wydatek'} disabled={busy} onPress={()=>void save()}/>
                    <Text style={s.hint}>Kwota zostanie dodana do pozostałych wydatków w tej kategorii.</Text>
                </>}
            </ScrollView>:<>
            {history&&<Text style={[s.hint,{marginBottom:12}]}>{new Date(year,month-1,1).toLocaleDateString('pl-PL',{month:'long',year:'numeric'})}</Text>}
            {historyError?<View><Text style={s.hint}>Nie udało się wczytać historii.</Text><Button title="Ponów" onPress={()=>setRetry(n=>n+1)}/></View>:!result?<ActivityIndicator style={{marginVertical:24}}/>:
                <FlatList data={result.entries} keyExtractor={item=>item.id} style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{paddingBottom:12}}
                    ListHeaderComponent={<View><View style={styles.totalRow}><Text style={s.name}>Łącznie w miesiącu</Text><Text style={styles.total}>{money(total)}</Text></View>
                        {result.legacy.map(entry=><View key={entry.period} style={styles.legacy}><Text style={s.name}>{money(entry.amount)}</Text><Text style={s.hint}>Wcześniejsza kwota zbiorcza · {entry.period.length===10?`tydzień ${weekLabel(entry.period)}`:'miesiąc'}</Text><Text style={s.hint}>Zachowana z poprzedniej wersji. Brak dat poszczególnych zakupów.{entry.period.length===10?' Pokazana część przypadająca na ten miesiąc.':''}</Text></View>)}
                    </View>}
                    ListEmptyComponent={<Text style={[s.hint,{marginVertical:16}]}>{result.legacy.length?'Nowe zakupy pojawią się tutaj jako osobne wpisy.':'Brak wydatków w tym miesiącu.'}</Text>}
                    renderItem={({item})=><View style={styles.entry}><View style={{flex:1}}><Text style={s.name}>{expenseDateLabel(item.spentOn)}</Text>{item.note?<Text style={s.hint}>{item.note}</Text>:null}<Text style={styles.timestamp}>Dodano {new Date(item.createdAt).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</Text></View><View style={{alignItems:'flex-end'}}><Text style={styles.entryAmount}>{money(item.amount)}</Text><Pressable disabled={!!deleting} accessibilityRole="button" accessibilityLabel={`Usuń wydatek ${money(item.amount)} z ${expenseDateLabel(item.spentOn)}`} hitSlop={8} onPress={()=>Alert.alert('Usunąć wydatek?',`${money(item.amount)} · ${expenseDateLabel(item.spentOn)}`,[{text:'Anuluj',style:'cancel'},{text:'Usuń',style:'destructive',onPress:()=>void remove(item)}])}><Text style={styles.delete}>{deleting===item.id?'Usuwanie…':'Usuń'}</Text></Pressable></View></View>}/>
            }
            {history&&categories.some(c=>c.id===history.category.id)&&<Button title="＋ Dodaj kolejny wydatek" disabled={!!deleting} onPress={()=>openAdd(history.category.id)}/>}
            </>}
        </BottomSheet>
    </Context.Provider>;
}
const styles=StyleSheet.create({
    notice:{position:'absolute',left:16,right:16,zIndex:10,backgroundColor:colors.green,padding:14,borderRadius:12},
    overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(15,23,42,0.45)'},
    sheet:{maxHeight:'90%',backgroundColor:'white',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10},
    handle:{width:40,height:5,borderRadius:3,backgroundColor:'#cbd5de',alignSelf:'center',marginBottom:16},
    heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:18},
    close:{fontSize:30,color:colors.muted,lineHeight:32},
    amountInput:{fontSize:32,fontWeight:'700',paddingVertical:16},
    error:{color:colors.red,marginTop:12},
    totalRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingVertical:14},
    total:{fontSize:22,fontWeight:'800',color:colors.ink},
    entry:{flexDirection:'row',gap:12,paddingVertical:16,borderTopWidth:1,borderColor:'#edf0f2'},
    entryAmount:{fontSize:19,fontWeight:'700',color:colors.ink},
    timestamp:{fontSize:11,color:colors.muted,marginTop:6},
    delete:{color:colors.red,fontSize:13,marginTop:10,paddingVertical:4},
    legacy:{backgroundColor:'#f4f6f8',padding:12,borderRadius:12,marginBottom:10},
});
