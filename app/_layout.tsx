import {Stack} from 'expo-router';
import {PwaProvider} from '../src/pwa';
import {Provider} from '../src/context';
import {ExpenseProvider} from '../src/expenses';
export default function Root(){return <PwaProvider><Provider><ExpenseProvider><Stack screenOptions={{headerShown:false}}/></ExpenseProvider></Provider></PwaProvider>}
