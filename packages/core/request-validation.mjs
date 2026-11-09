/** The UAT API accepts only JSON objects; validation errors are safe to show to callers. */
export function requestError(status,message){return Object.assign(new Error(message),{status});}
export function strictJsonObject(source=''){
 let value;
 try{value=JSON.parse(source||'{}');}catch{throw requestError(400,'Invalid JSON. Review the request and try again.');}
 if(value===null||typeof value!=='object'||Array.isArray(value))throw requestError(400,'Request body must be a JSON object.');
 return value;
}
export function strictMinorUnits(value,name='Amount',{min=0,max=1_000_000_000}={}){
 const isNumber=typeof value==='number';
 const isDigits=typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value);
 if(!isNumber&&!isDigits)throw requestError(400,`Invalid ${name}. Enter a whole number of paise.`);
 const amount=Number(value);
 if(!Number.isSafeInteger(amount)||amount<min||amount>max)throw requestError(400,`Invalid ${name}. Enter a whole number of paise.`);
 return amount;
}
