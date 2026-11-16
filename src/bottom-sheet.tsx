import React from 'react';
import {KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors,s} from './ui';
export function BottomSheet({visible,title,onClose,children}:{visible:boolean;title:string;onClose:()=>void;children:React.ReactNode}){
    const insets=useSafeAreaInsets();
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij panel" style={StyleSheet.absoluteFill} onPress={onClose}/>
            <View accessibilityViewIsModal style={[styles.sheet,{paddingBottom:Math.max(16,insets.bottom)}]}>
                <View style={styles.handle}/>
                <View style={styles.heading}><Text accessibilityRole="header" style={[s.title,{flex:1,marginBottom:0}]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Zamknij" hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
                {children}
            </View>
        </KeyboardAvoidingView>
    </Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(15,23,42,0.45)'},sheet:{maxHeight:'90%',backgroundColor:'white',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10},handle:{width:40,height:5,borderRadius:3,backgroundColor:'#cbd5de',alignSelf:'center',marginBottom:16},heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:18},close:{fontSize:30,color:colors.muted,lineHeight:32}});
