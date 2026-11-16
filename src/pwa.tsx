import React from 'react';
import type {PwaState} from './pwa.types';
export function PwaProvider({children}:{children:React.ReactNode}){return <>{children}</>}
export function usePwa():PwaState{return {offline:false,offlineReady:false,canInstall:false,installed:false,updateAvailable:false,persisted:false,install:async()=>{},applyUpdate:async()=>{},requestPersistence:async()=>{}}}
