import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Category } from './domain';
import { getCategories, initDb } from './db';
import { Button, s } from './ui';
type AppContext = {
    ready: boolean;
    categories: Category[];
    refresh: () => Promise<void>;
};
const C = createContext<AppContext>({ ready: false, categories: [], refresh: async () => { } });
export function Provider({ children }: {
    children: React.ReactNode;
}) {
    const [ready, setReady] = useState(false), [categories, setCategories] = useState<Category[]>([]), [error, setError] = useState(false);
    async function refresh() { setCategories(await getCategories()); }
    async function load() { setError(false); try {
        await initDb();
        await refresh();
        setReady(true);
    }
    catch {
        setError(true);
    } }
    useEffect(() => { void load(); }, []);
    if (error)
        return <View style={[s.content, { flex: 1, justifyContent: 'center' }]}><Text style={s.name}>Nie udało się otworzyć budżetu.</Text><Text style={s.hint}>Spróbuj ponownie. Nie usuwaj aplikacji — jej dane są zapisane na tym urządzeniu.</Text><Button title="Spróbuj ponownie" onPress={() => void load()}/></View>;
    if (!ready)
        return <ActivityIndicator style={{ flex: 1 }}/>;
    return <C.Provider value={{ ready, categories, refresh }}>{children}</C.Provider>;
}
export const useBudget = () => useContext(C);
