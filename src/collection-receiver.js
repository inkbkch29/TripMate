// Historical requests must never silently switch to a newly configured receiving QR.
export function collectionReceiver(collection,members=[]){
 if(!collection)return null;const member=members.find(m=>m.id===collection.receiver);
 const account=collection.receivingAccount;
 if(!account)return member||null;
 return {...member,id:collection.receiver,name:account.display_name||member?.name||'ผู้รับเงิน',accountName:account.account_name||'',bankName:account.bank_name||'',promptpay:account.promptpay_id||'',paymentQr:account.paymentQr||'',paymentQrPath:account.payment_qr_path||'',historicalAccount:true};
}
