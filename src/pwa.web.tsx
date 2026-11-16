import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {flushPendingWrites} from './db';
import {Button,colors} from './ui';
import type {PwaState} from './pwa.types';
interface InstallPrompt extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
const Context=createContext<PwaState|null>(null);
export function usePwa(){const context=useContext(Context);if(!context)throw new Error('Brak ustawień PWA');return context}
export function PwaProvider({children}:{children:React.ReactNode}){
    const [offline,setOffline]=useState(!navigator.onLine),[offlineReady,setOfflineReady]=useState(false),[installed,setInstalled]=useState(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
    const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[updateAvailable,setUpdateAvailable]=useState(false),[persisted,setPersisted]=useState(false);
    const registration=useRef<ServiceWorkerRegistration|null>(null);
    useEffect(()=>{
        let active=true;
        const online=()=>setOffline(false),offline=()=>setOffline(true);
        const installPrompt=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};
        const installed=()=>{setInstalled(true);setPrompt(null)};
        window.addEventListener('online',online);window.addEventListener('offline',offline);
        window.addEventListener('beforeinstallprompt',installPrompt);window.addEventListener('appinstalled',installed);
        navigator.storage?.persisted?.().then(value=>{if(active)setPersisted(value)}).catch(()=>{});
        // Only the production build contains a generated offline service worker.
        if('serviceWorker' in navigator&&!__DEV__){
            navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
                if(!active)return;
                registration.current=reg;
                setUpdateAvailable(!!reg.waiting);
                reg.addEventListener('updatefound',()=>{
                    const worker=reg.installing;
                    worker?.addEventListener('statechange',()=>{
                        if(!active)return;
                        if(worker.state==='installed'){
                            if(navigator.serviceWorker.controller)setUpdateAvailable(true);
                            else setOfflineReady(true);
                        }
                    });
                });
                return navigator.serviceWorker.ready;
            }).then(ready=>{if(ready&&active)setOfflineReady(true)}).catch(()=>{if(active)setOfflineReady(false)});
        }
        return()=>{active=false;window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('beforeinstallprompt',installPrompt);window.removeEventListener('appinstalled',installed)};
    },[]);
    async function install(){if(!prompt)return;await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setInstalled(true);setPrompt(null)}
    async function requestPersistence(){try{setPersisted(await navigator.storage?.persist?.()||false)}catch{setPersisted(false)}}
    async function applyUpdate(){
        const waiting=registration.current?.waiting;if(!waiting)return;
        if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
        await flushPendingWrites();
        navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});
        waiting.postMessage({type:'SKIP_WAITING'});
    }
    return <Context.Provider value={{offline,offlineReady,canInstall:!!prompt,installed,updateAvailable,persisted,install,applyUpdate,requestPersistence}}>
        <View style={{flex:1,backgroundColor:colors.bg}}>
            {offline&&<View accessibilityRole="alert" style={{backgroundColor:colors.ink,padding:10}}><Text style={{textAlign:'center',color:'white'}}>Tryb offline · wydatki zapisują się na tym urządzeniu</Text></View>}
            {updateAvailable&&<View style={{padding:12,backgroundColor:'#e9f6ee'}}><Text style={{textAlign:'center',color:colors.ink}}>Dostępna nowa wersja aplikacji.</Text><Button title="Zapisz zmiany i odśwież" onPress={()=>void applyUpdate()}/></View>}
            <View style={{flex:1,width:'100%',maxWidth:900,alignSelf:'center'}}>{children}</View>
        </View>
    </Context.Provider>;
}
