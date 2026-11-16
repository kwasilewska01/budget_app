import {Stack} from 'expo-router';
import {Provider} from '../src/context';
import {ExpenseProvider} from '../src/expenses';
export default function Root(){return <Provider><ExpenseProvider><Stack screenOptions={{headerShown:false}}/></ExpenseProvider></Provider>}
