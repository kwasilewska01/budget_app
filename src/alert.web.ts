import type {AlertButton, AlertOptions} from 'react-native';
// React Native Web's Alert is a no-op. Keep confirmations working on the web.
export const Alert = {
    alert(title: string, message?: string, buttons?: AlertButton[], _options?: AlertOptions) {
        const content = [title,message].filter(Boolean).join('\n\n');
        if (!buttons || buttons.length <= 1) {
            window.alert(content);
            buttons?.[0]?.onPress?.();
            return;
        }
        const cancel = buttons.find(button=>button.style==='cancel') || buttons[0];
        const accept = [...buttons].reverse().find(button=>button!==cancel);
        if (window.confirm(content)) accept?.onPress?.();
        else cancel?.onPress?.();
    },
};
