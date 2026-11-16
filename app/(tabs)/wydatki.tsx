import {useMoney} from '../../src/context';
import React,{useCallback,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {getActuals,getMonthCategories} from '../../src/db';
import {Category,categoryTotals,monthKey} from '../../src/domain';
import {useExpenses} from '../../src/expenses';
import {Button,Card,colors,s} from '../../src/ui';
export default function Expenses(){
    const {money,unit}=useMoney();
    const now=new Date();
    const [year,setYear]=useState(now.getFullYear()),[month,setMonth]=useState(now.getMonth());
    const [categories,setCategories]=useState<Category[]>([]),[actuals,setActuals]=useState<Record<string,number>>({});
    const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
    const {revision,openAdd,openHistory}=useExpenses();
    const period=monthKey(year,month);
    useFocusEffect(useCallback(()=>{
        let active=true;setLoading(true);setFailed(false);
        Promise.all([getMonthCategories(period),getActuals()]).then(([c,a])=>{if(active){setCategories(c);setActuals(a);setLoading(false)}}).catch(()=>{if(active){setFailed(true);setLoading(false)}});
        return()=>{active=false};
    },[period,revision,retry]));
    function changeMonth(offset:number){const d=new Date(year,month+offset,1);setYear(d.getFullYear());setMonth(d.getMonth())}
    const spent=categories.reduce((sum,c)=>sum+Math.round(categoryTotals(c,actuals,year,month).actual*100),0)/100;
    function row(c:Category){
        const total=categoryTotals(c,actuals,year,month);
        return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${money(total.actual)}. Pokaż historię wydatków`} onPress={()=>openHistory(c,period)} style={{borderTopWidth:1,borderColor:'#edf0f2',paddingVertical:16}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><Text style={[s.name,{flex:1}]}>{c.name}</Text><Text style={{fontSize:20,fontWeight:'800',color:colors.ink}}>{money(total.actual)}</Text><Text style={{fontSize:24,color:colors.muted}}>›</Text></View>
            <Text style={s.hint}>Plan: {money(total.plan)}{total.actual>total.plan?' · Przekroczony plan':''}</Text>
            <View style={{height:6,backgroundColor:'#edf0f2',borderRadius:3,marginTop:10}}><View style={{height:6,borderRadius:3,width:`${total.plan?Math.min(100,total.actual/total.plan*100):total.actual?100:0}%`,backgroundColor:total.actual>total.plan?colors.red:colors.green}}/></View>
            <Text style={s.hint}>Dotknij, aby zobaczyć kwoty i daty</Text>
        </Pressable>;
    }
    return <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Text style={s.title}>Twoje wydatki</Text>
        <Card><Text style={s.name}>{new Date(year,month,1).toLocaleDateString('pl-PL',{month:'long',year:'numeric'})}</Text><View style={s.row}><Button title="‹ Poprzedni" secondary onPress={()=>changeMonth(-1)}/><Button title="Następny ›" secondary onPress={()=>changeMonth(1)}/></View></Card>
        {loading?<ActivityIndicator style={{margin:24}}/>:failed?<Card><Text>Nie udało się wczytać wydatków.</Text><Button title="Ponów" onPress={()=>setRetry(n=>n+1)}/></Card>:<>
            <Card><Text style={s.label}>Wydano w tym miesiącu</Text><Text style={s.amount}>{money(spent)}</Text><Button title="＋ Dodaj wydatek" onPress={()=>openAdd()}/><Text style={s.hint}>Każdy zakup dodajesz osobno. Sumy aktualizują się automatycznie według dat wydatków.</Text></Card>
            {(['daily','fixed'] as const).map(kind=><Card key={kind}><Text style={[s.name,{marginBottom:12}]}>{kind==='daily'?'Codzienne':'Firmowe'}</Text>{categories.filter(c=>c.kind===kind).map(row)}{!categories.some(c=>c.kind===kind)&&<Text style={s.hint}>Brak kategorii w tym miesiącu.</Text>}</Card>)}
        </>}
    </ScrollView>;
}
