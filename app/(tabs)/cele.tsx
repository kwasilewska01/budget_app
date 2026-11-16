import {useMoney} from '../../src/context';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Alert} from '../../src/alert';
import {BottomSheet} from '../../src/bottom-sheet';
import {useBudget} from '../../src/context';
import {addGoalContribution,createGoal,deleteGoalContribution,getGoalContributions,getGoals,getMonthGoalSavings,setGoalArchived,updateGoal} from '../../src/db';
import {dateKey,expenseDateFromInput,expenseDateInputError,expenseDateLabel,GoalContribution,goalProgress,monthKey,numberFromInput,SavingsGoal} from '../../src/domain';
import {clearZeroOnFocus} from '../../src/number-input';
import {Button,Card,colors,s} from '../../src/ui';
const makeId=(prefix:string)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
const defaultPaymentDate=(period:string)=>{const today=dateKey(new Date());return expenseDateLabel(today.slice(0,7)===period?today:period+'-01')};
const monthTitle=(period:string)=>{const [y,m]=period.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('pl-PL',{month:'long',year:'numeric'})};
function Progress({goal}:{goal:SavingsGoal}){
    const {money,unit}=useMoney();
    const progress=goalProgress(goal.saved,goal.target);
    return <View>
        <Text style={styles.saved}>{money(goal.saved)} <Text style={styles.target}>z {money(goal.target)}</Text></Text>
        <View accessibilityRole="progressbar" accessibilityLabel={`Postęp celu ${goal.name}`} accessibilityValue={{min:0,max:100,now:progress.percentage}} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} style={styles.track}><View style={[styles.fill,{width:`${progress.percentage}%`}]}/></View>
        <View style={styles.spread}><Text style={s.hint}>{progress.percentage.toLocaleString('pl-PL')}% celu</Text><Text style={s.hint}>{progress.completed?'Cel osiągnięty ✓':`Pozostało ${money(progress.remaining)}`}</Text></View>
    </View>;
}
export default function Goals(){
    const {money,unit}=useMoney();
    const now=new Date();
    const [year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth());
    const period=monthKey(year,month);
    const {revision,refresh}=useBudget();
    const [goals,setGoals]=useState<SavingsGoal[]>([]),[monthSavings,setMonthSavings]=useState(0),[showArchived,setShowArchived]=useState(false);
    const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
    const [mode,setMode]=useState<'create'|'edit'|'details'|null>(null),[selectedId,setSelectedId]=useState('');
    const [name,setName]=useState(''),[target,setTarget]=useState('');
    const [amount,setAmount]=useState(''),[paidOn,setPaidOn]=useState(''),[note,setNote]=useState(''),[dateTouched,setDateTouched]=useState(false);
    const [entries,setEntries]=useState<GoalContribution[]>([]),[historyLoading,setHistoryLoading]=useState(false),[historyFailed,setHistoryFailed]=useState(false),[historyRetry,setHistoryRetry]=useState(0);
    const [busy,setBusy]=useState(false),[error,setError]=useState('');
    const saving=useRef(false),goalRequest=useRef(''),contributionRequest=useRef('');
    const goal=goals.find(item=>item.id===selectedId);
    const dateError=expenseDateInputError(paidOn),showDateError=!!dateError&&(dateTouched||paidOn.trim().length>=10);
    useFocusEffect(useCallback(()=>{
        let active=true;setLoading(true);setFailed(false);
        Promise.all([getGoals(period,showArchived),getMonthGoalSavings(period)]).then(([rows,total])=>{if(active){setGoals(rows);setMonthSavings(total);setLoading(false)}}).catch(()=>{if(active){setFailed(true);setLoading(false)}});
        return()=>{active=false};
    },[period,showArchived,revision,retry]));
    useEffect(()=>{
        if(mode!=='details'||!selectedId)return;
        let active=true;setHistoryLoading(true);setHistoryFailed(false);
        getGoalContributions(selectedId).then(rows=>{if(active){setEntries(rows);setHistoryLoading(false)}}).catch(()=>{if(active){setHistoryFailed(true);setHistoryLoading(false)}});
        return()=>{active=false};
    },[mode,selectedId,revision,historyRetry]);
    function changeMonth(offset:number){const date=new Date(year,month+offset,1);setYear(date.getFullYear());setMonth(date.getMonth())}
    function openCreate(){goalRequest.current=makeId('goal');setName('');setTarget('');setError('');setMode('create')}
    function openDetails(item:SavingsGoal){
        setSelectedId(item.id);setMode('details');setAmount('');setNote('');setError('');setDateTouched(false);
        setPaidOn(defaultPaymentDate(period));
        contributionRequest.current=makeId('contribution');
    }
    function openEdit(){if(!goal)return;setName(goal.name);setTarget(String(goal.target));setError('');setMode('edit')}
    async function mutate(work:()=>Promise<void>){
        if(saving.current)return;
        saving.current=true;setBusy(true);setError('');
        try{await work()}catch(cause){setError(cause instanceof Error?cause.message:'Nie zapisano zmian. Spróbuj ponownie.')}
        finally{saving.current=false;setBusy(false)}
    }
    function saveGoal(){return mutate(async()=>{
        const value=numberFromInput(target);
        if(value<=0)throw new Error('Kwota celu musi być większa od zera.');
        if(mode==='edit'){await updateGoal(selectedId,name,value);await refresh();setMode('details')}
        else{
            const id=goalRequest.current;
            await createGoal({id,name,target:value,createdAt:new Date().toISOString()});
            await refresh();setSelectedId(id);setMode('details');setAmount('');setNote('');setPaidOn(defaultPaymentDate(period));setDateTouched(false);contributionRequest.current=makeId('contribution');
        }
    })}
    function saveContribution(){return mutate(async()=>{
        await addGoalContribution({id:contributionRequest.current,goalId:selectedId,amount:numberFromInput(amount),paidOn:expenseDateFromInput(paidOn),createdAt:new Date().toISOString(),note});
        await refresh();setAmount('');setNote('');contributionRequest.current=makeId('contribution');
    })}
    function archive(archived:boolean){return mutate(async()=>{await setGoalArchived(selectedId,archived);await refresh();setMode(null)})}
    function removeEntry(entry:GoalContribution){
        Alert.alert('Usunąć wpłatę?',`${money(entry.amount)} · ${expenseDateLabel(entry.paidOn)}. Zebrana suma i budżet tego miesiąca zostaną przeliczone.`,[{text:'Anuluj',style:'cancel'},{text:'Usuń wpłatę',style:'destructive',onPress:()=>void mutate(async()=>{await deleteGoalContribution(entry.id);await refresh()})}]);
    }
    const grouped=entries.reduce<Record<string,GoalContribution[]>>((groups,entry)=>{const key=entry.paidOn.slice(0,7);(groups[key]??=[]).push(entry);return groups},{});
    return <>
        <ScrollView style={s.screen} contentContainerStyle={s.content}>
            <Text style={s.title}>Cele oszczędnościowe</Text>
            <Text style={[s.hint,{marginTop:-6,marginBottom:16}]}>Na samochód, podróż lub coś ważnego. Odkładaj dowolne kwoty i obserwuj postęp.</Text>
            <Card><Text style={s.name}>{monthTitle(period)}</Text><View style={s.row}><Button title="‹ Poprzedni" secondary onPress={()=>changeMonth(-1)}/><Button title="Następny ›" secondary onPress={()=>changeMonth(1)}/></View><Text style={[s.label,{marginTop:16}]}>Wpłaty na cele w tym miesiącu</Text><Text style={styles.saved}>{money(monthSavings)}</Text><Text style={s.hint}>Wpłaty są automatycznie odejmowane od dostępnego budżetu tego miesiąca.</Text></Card>
            <Button title="＋ Utwórz cel" onPress={openCreate}/>
            <Button title={showArchived?'Ukryj archiwalne cele':'Pokaż archiwalne cele'} secondary onPress={()=>setShowArchived(value=>!value)}/>
            {error&&!mode&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {loading?<ActivityIndicator style={{margin:24}}/>:failed?<Card><Text>Nie udało się wczytać celów.</Text><Button title="Ponów" onPress={()=>setRetry(n=>n+1)}/></Card>:goals.length===0?<View style={{marginTop:18}}><Card><Text style={s.name}>Zacznij odkładać na cel</Text><Text style={s.hint}>Podaj nazwę i kwotę, np. „Nowy samochód” i {money(40000)}. Każdą odłożoną kwotę dodasz jako osobną wpłatę.</Text></Card></View>:<View style={{marginTop:18}}>{goals.map(item=><Card key={item.id}><Pressable accessibilityRole="button" accessibilityLabel={`Cel ${item.name}. Pokaż postęp i wpłaty`} onPress={()=>openDetails(item)}><View style={styles.spread}><Text style={[s.name,{flex:1}]}>{item.name}</Text><Text style={s.hint}>{item.archived?'Archiwalny':'›'}</Text></View><Progress goal={item}/><Text style={s.hint}>W wybranym miesiącu: {money(item.monthly)}</Text><Text style={s.hint}>Dotknij, aby dodać wpłatę lub zobaczyć historię</Text></Pressable></Card>)}</View>}
        </ScrollView>
        <BottomSheet visible={!!mode} title={mode==='create'?'Nowy cel':mode==='edit'?'Edytuj cel':goal?.name||'Cel oszczędnościowy'} onClose={()=>{if(!saving.current){setMode(null);setError('')}}}>
            <ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:16}}>
                {mode==='create'||mode==='edit'?<>
                    <Text style={s.label}>Na co odkładasz?</Text><TextInput autoFocus accessibilityLabel="Nazwa celu" value={name} onChangeText={setName} maxLength={100} editable={!busy} placeholder="Np. Nowy samochód" style={s.input}/>
                    <Text style={[s.label,{marginTop:16}]}>{`Kwota docelowa (${unit})`}</Text><TextInput accessibilityLabel={`Kwota celu (${unit})`} value={target} onChangeText={setTarget} onFocus={()=>setTarget(clearZeroOnFocus)} keyboardType="decimal-pad" editable={!busy} placeholder="40000" style={s.input}/>
                    {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                    <Button title={busy?'Zapisywanie…':mode==='create'?'Utwórz cel':'Zapisz cel'} disabled={busy} onPress={()=>void saveGoal()}/>
                    {mode==='edit'&&<Button title="Wróć do celu" secondary disabled={busy} onPress={()=>{setError('');setMode('details')}}/>}
                </>:goal?<>
                    <Progress goal={goal}/>
                    <Text style={s.hint}>Cel: {money(goal.target)} · Wpłaty: {goal.contributionCount}</Text>
                    {goal.archived?<><Text style={[s.hint,{marginTop:16}]}>Ten cel jest w archiwum. Historia wpłat pozostaje w budżecie.</Text><Button title="Przywróć cel" disabled={busy} onPress={()=>void archive(false)}/></>:<>
                        <View style={s.row}><Button title="Edytuj cel" secondary disabled={busy} onPress={openEdit}/><Button title="Archiwizuj cel" secondary disabled={busy} onPress={()=>Alert.alert('Archiwizować cel?','Cel zniknie z aktywnej listy. Wpłaty, postęp i rozliczenia wcześniejszych miesięcy zostaną zachowane.',[{text:'Anuluj',style:'cancel'},{text:'Archiwizuj',onPress:()=>void archive(true)}])}/></View>
                        <View style={styles.form}><Text style={s.name}>Dodaj wpłatę na cel</Text><Text style={s.hint}>Wpisz tylko nową kwotę — dodamy ją do dotychczasowych wpłat.</Text>
                            <Text style={[s.label,{marginTop:14}]}>{`Kwota wpłaty (${unit})`}</Text><TextInput accessibilityLabel={`Kwota wpłaty (${unit})`} value={amount} onChangeText={setAmount} onFocus={()=>setAmount(clearZeroOnFocus)} keyboardType="decimal-pad" placeholder="0,00" editable={!busy} style={s.input}/>
                            <Text style={[s.label,{marginTop:12}]}>Data wpłaty</Text><TextInput accessibilityLabel="Data wpłaty" value={paidOn} onChangeText={setPaidOn} onBlur={()=>setDateTouched(true)} maxLength={10} placeholder="DD.MM.RRRR" editable={!busy} aria-invalid={showDateError} style={[s.input,showDateError&&{borderColor:colors.red}]}/>
                            {showDateError&&<Text accessibilityRole="alert" style={styles.error}>{dateError}</Text>}
                            <Text style={[s.label,{marginTop:12}]}>Opis (opcjonalnie)</Text><TextInput accessibilityLabel="Opis wpłaty" value={note} onChangeText={setNote} maxLength={500} placeholder="Np. oszczędności z wypłaty" editable={!busy} style={s.input}/>
                            <Button title={busy?'Zapisywanie…':'Dodaj wpłatę'} disabled={busy||!!dateError} onPress={()=>void saveContribution()}/>
                            <Text style={s.hint}>Wpłata zmniejszy dostępny budżet miesiąca wskazanego datą. Nie wpisuj jej drugi raz w „Oszczędności poza celami”.</Text>
                        </View>
                    </>}
                    {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                    <Text style={[s.name,{marginTop:22,marginBottom:8}]}>Historia wpłat</Text>
                    {historyLoading?<ActivityIndicator/>:historyFailed?<><Text style={s.hint}>Nie udało się wczytać wpłat.</Text><Button title="Ponów wczytywanie wpłat" onPress={()=>setHistoryRetry(n=>n+1)}/></>:entries.length===0?<Text style={s.hint}>Jeszcze nie ma wpłat. Zacznij od dowolnej kwoty.</Text>:Object.entries(grouped).map(([key,rows])=><View key={key}><View style={styles.monthRow}><Text style={s.name}>{monthTitle(key)}</Text><Text style={s.name}>{money(rows.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100)}</Text></View>{rows.map(entry=><View key={entry.id} style={styles.entry}><View style={{flex:1}}><Text style={s.name}>{expenseDateLabel(entry.paidOn)}</Text>{entry.note?<Text style={s.hint}>{entry.note}</Text>:null}</View><View style={{alignItems:'flex-end'}}><Text style={s.name}>{money(entry.amount)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Usuń wpłatę ${money(entry.amount)} z ${expenseDateLabel(entry.paidOn)}`} disabled={busy} hitSlop={8} onPress={()=>removeEntry(entry)}><Text style={styles.delete}>Usuń</Text></Pressable></View></View>)}</View>)}
                </>:<ActivityIndicator/>}
            </ScrollView>
        </BottomSheet>
    </>;
}
const styles=StyleSheet.create({saved:{fontSize:25,fontWeight:'800',color:colors.green,marginTop:12},target:{fontSize:15,fontWeight:'500',color:colors.muted},track:{height:10,borderRadius:5,backgroundColor:'#e2e8ee',marginTop:14,overflow:'hidden'},fill:{height:10,borderRadius:5,backgroundColor:colors.green},spread:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},error:{color:colors.red,marginTop:12},form:{marginTop:20,padding:14,borderRadius:14,backgroundColor:'#f4f6f8'},monthRow:{flexDirection:'row',justifyContent:'space-between',gap:12,paddingVertical:12,marginTop:6},entry:{flexDirection:'row',gap:12,paddingVertical:14,borderTopWidth:1,borderColor:'#edf0f2'},delete:{color:colors.red,fontSize:13,marginTop:8,paddingVertical:4}});
