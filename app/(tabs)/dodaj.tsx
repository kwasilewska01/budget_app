import {useFocusEffect, useRouter} from 'expo-router';
import {useCallback} from 'react';
import {useExpenses} from '../../src/expenses';
// Handles a direct link too; ordinary tab presses open the composer without navigation.
export default function AddExpense(){
    const {openAdd}=useExpenses();const router=useRouter();
    useFocusEffect(useCallback(()=>{router.replace('/');openAdd()},[]));
    return null;
}
