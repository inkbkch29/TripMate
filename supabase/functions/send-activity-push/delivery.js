export async function sendWithRetry(send,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 for(let attempt=0;attempt<3;attempt++){
  try{return await send();}catch(error){const status=Number(error?.statusCode||0);if(attempt===2||status>0&&status!==429&&status<500)throw error;await delay(attempt===0?250:1000);}
 }
}
