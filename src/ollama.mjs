const origin='http://127.0.0.1:11434';
export const DEFAULT_LOCAL_MODEL='qwen3:1.7b';
export async function localModelStatus(transport=fetch){
  try{const response=await transport(origin+'/api/tags',{signal:AbortSignal.timeout(2000)});if(!response.ok)throw new Error();const data=await response.json();return {running:true,models:(data.models||[]).map(m=>m.name)}}catch{return {running:false,models:[]}}
}
export async function ollama(model,body,_key,{onText,timeout=120000,transport=fetch}={}){
  if(body.tools?.some(t=>t.googleSearch))throw new Error('Local AI has no Google grounding. Ask Grim to search in your browser.');
  const messages=[];
  if(body.systemInstruction)messages.push({role:'system',content:body.systemInstruction.parts.map(p=>p.text||'').join('\n')});
  for(const entry of body.contents||[]){
    if(entry.parts.some(p=>p.inlineData))throw new Error('The selected local text model cannot read screenshots. Choose a local vision model before using screen questions.');
    const calls=entry.parts.filter(p=>p.functionCall).map(p=>({type:'function',function:{name:p.functionCall.name,arguments:p.functionCall.args}}));
    for(const part of entry.parts.filter(p=>p.functionResponse))messages.push({role:'tool',tool_name:part.functionResponse.name,content:JSON.stringify(part.functionResponse.response)});
    const content=entry.parts.map(p=>p.text||'').filter(Boolean).join('\n');
    if(content||calls.length)messages.push({role:entry.role==='model'?'assistant':entry.role,content,...(calls.length&&{tool_calls:calls})});
  }
  const tools=(body.tools||[]).flatMap(t=>t.functionDeclarations||[]).map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parametersJsonSchema}}));
  let response;
  try{response=await transport(origin+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,tools,stream:!!onText,think:false,keep_alive:'10m',...(body.generationConfig?.responseJsonSchema&&{format:body.generationConfig.responseJsonSchema}),options:{num_ctx:4096,num_predict:body.generationConfig?.responseJsonSchema?2048:768,num_thread:3,temperature:.3}}),signal:AbortSignal.timeout(timeout)})}catch(error){throw new Error(error.name==='TimeoutError'?'Local model timed out. Try a shorter request.':'The local model server is unavailable. Restart Grim to start Ollama.');}
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||`Local model failed (${response.status}).`)}
  let content='',calls=[];
  const accept=data=>{if(data.error)throw new Error(data.error);const message=data.message||{};if(message.content){content+=message.content;onText?.(message.content)}if(message.tool_calls)calls.push(...message.tool_calls)};
  if(onText){const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';try{while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);if(line.trim())accept(JSON.parse(line))}}pending+=decoder.decode();if(pending.trim())accept(JSON.parse(pending))}finally{reader.releaseLock()}}
  else accept(await response.json());
  return {candidates:[{content:{role:'model',parts:[...(content?[{text:content}]:[]),...calls.map(c=>({functionCall:{name:c.function.name,args:c.function.arguments||{}}}))]},finishReason:'STOP'}]};
}
