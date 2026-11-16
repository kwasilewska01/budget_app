import {Tabs} from 'expo-router';
import {Text,View} from 'react-native';
import {useExpenses} from '../../src/expenses';
import {colors} from '../../src/ui';
export default function Layout(){
    const {openAdd}=useExpenses();
    return <Tabs screenOptions={{headerStyle:{backgroundColor:colors.ink},headerTintColor:'#fff',tabBarActiveTintColor:colors.blue,tabBarLabelStyle:{fontSize:11}}}>
        <Tabs.Screen name="index" options={{title:'Budżet',tabBarLabel:'Budżet',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>◫</Text>}}/>
        <Tabs.Screen name="wydatki" options={{title:'Wydatki',tabBarLabel:'Wydatki',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>≡</Text>}}/>
        <Tabs.Screen name="dodaj" listeners={{tabPress:event=>{event.preventDefault();openAdd()}}} options={{title:'Dodaj wydatek',tabBarLabel:'Dodaj',tabBarAccessibilityLabel:'Dodaj nowy wydatek',tabBarIcon:()=> <View style={{width:38,height:38,borderRadius:19,backgroundColor:colors.blue,alignItems:'center',justifyContent:'center',marginTop:-8}}><Text style={{fontSize:30,color:'white',lineHeight:34}}>＋</Text></View>}}/>
        <Tabs.Screen name="cele" options={{title:'Cele oszczędnościowe',tabBarLabel:'Cele',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>◎</Text>}}/>
        <Tabs.Screen name="konfigurator" options={{title:'Konfigurator',tabBarLabel:'Kategorie',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>▦</Text>}}/>
        <Tabs.Screen name="ustawienia" options={{title:'Ustawienia',tabBarLabel:'Ustaw.',tabBarAccessibilityLabel:'Ustawienia',tabBarIcon:({color})=><Text style={{fontSize:22,color}}>⚙</Text>}}/>
    </Tabs>;
}
