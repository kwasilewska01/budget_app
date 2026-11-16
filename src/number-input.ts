export function clearZeroOnFocus(value:string){
    return /^0+(?:[.,]0*)?$/.test(value.trim())?'':value;
}
export function normalizeEmptyAmount(value:string){return value.trim()===''?'0':value}
