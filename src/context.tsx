import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Category, money, currencyLabel } from './domain';
import { getCategories, initDb, getCurrency } from './db';
import { Button, s } from './ui';
type AppContext = {
    currency:string;
    revision:number;
    ready: boolean;
    categories: Category[];
    refresh: () => Promise<void>;
};
const C = createContext<AppContext>({ currency:'PLN', revision:0, ready: false, categories: [], refresh: async () => { } });
export function Provider({ children }: {
    children: React.ReactNode;
}) {
    const [ready, setReady] = useState(false), [categories, setCategories] = useState<Category[]>([]), [error, setError] = useState('');
    const [currency,setCurrency]=useState('PLN');
    const [revision,setRevision]=useState(0);
    async function refresh() { const [items,unit]=await Promise.all([getCategories(),getCurrency()]);setCategories(items);setCurrency(unit);setRevision(n=>n+1); }
    async function load() { setError(''); try {
        await initDb();
        await refresh();
        setReady(true);
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Spróbuj ponownie.');
    } }
    useEffect(() => { void load(); }, []);
    if (error)
        return <View style={[s.content, { flex: 1, justifyContent: 'center' }]}><Text style={s.name}>Nie udało się otworzyć budżetu.</Text><Text style={s.hint}>{error}</Text><Text style={s.hint}>Nie usuwaj danych aplikacji. Jeśli budżet jest otwarty w innej karcie, zamknij ją i spróbuj ponownie.</Text><Button title="Spróbuj ponownie" onPress={() => void load()}/></View>;
    if (!ready)
        return <ActivityIndicator style={{ flex: 1 }}/>;
    return <C.Provider value={{ currency, revision, ready, categories, refresh }}>{children}</C.Provider>;
}
export const useBudget = () => useContext(C);

export function useMoney(){const {currency}=useBudget();return {money:(value:number)=>money(value,currency),unit:currencyLabel(currency)};}
