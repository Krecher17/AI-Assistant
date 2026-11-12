import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {browserIntent,runBrowserIntent} from '../src/browser.mjs';
import {ollama} from '../src/ollama.mjs';
import {chat,outputText} from '../src/ai.mjs';
import {toolDefinitions} from '../src/actions.mjs';
import {createApp} from '../server.mjs';
test('compound browser requests preserve query and browser, including encoded punctuation',async()=>{
  for(const phrase of ['open brave and search for youtube','Open Brave then search for YouTube','search for github in brave','serch for github']){
    const intent=browserIntent(phrase);assert.equal(intent.kind,'search');assert.equal(new URL(intent.url).hostname,'www.google.com');let opened;
    await runBrowserIntent(intent,async(url,browser)=>{opened={url,browser}});assert.equal(opened.url,intent.url);
  }
  assert.equal(browserIntent('open brave and search for C++ & node.js').url,'https://www.google.com/search?q=C%2B%2B%20%26%20node.js');
  assert.equal(browserIntent('open github').url,'https://github.com/');
  assert.equal(browserIntent('search youtube for async await in brave').url,'https://www.youtube.com/results?search_query=async%20await');
  assert.equal(browserIntent('open calculator'),null);assert.equal(browserIntent('explain how browsers search'),null);
  assert.equal(browserIntent('open javascript:alert(1)'),null);
});
test('Ollama transport streams split NDJSON, uses loopback and disables thinking',async()=>{
  let text='';const encoded=new TextEncoder().encode('{"message":{"content":"Hel"}}\n{"message":{"content":"lo"},"done":true}\n');
  const result=await ollama('qwen3:1.7b',{systemInstruction:{parts:[{text:'Grim'}]},contents:[{role:'user',parts:[{text:'Hi'}]}]},'',{onText:part=>text+=part,transport:async(url,options)=>{
    assert.equal(url,'http://127.0.0.1:11434/api/chat');const data=JSON.parse(options.body);assert.equal(data.think,false);assert.equal(data.options.num_thread,3);assert.equal(data.messages[0].role,'system');
    return new Response(new ReadableStream({start(c){c.enqueue(encoded.slice(0,17));c.enqueue(encoded.slice(17));c.close()}}));
  }});assert.equal(text,'Hello');assert.equal(outputText(result),'Hello');
});
test('local tool calls retain results, require available tools, and do not invoke cloud grounding',async()=>{
  let turn=0;
  const result=await chat({provider:'local',model:'qwen3:1.7b',messages:[],memory:[],question:'Search my WhatsApp notes',tools:toolDefinitions,execute:async()=>[{id:'s1',title:'Project',excerpt:'Review'}],request:async(_model,body)=>{
    assert.ok(!body.tools[0].functionDeclarations.some(t=>t.name==='web_search'));
    if(!turn++)return {candidates:[{content:{parts:[{functionCall:{name:'search_sources',args:{query:'review'}}}]}}]};
    assert.equal(body.contents.at(-1).parts[0].functionResponse.response.result[0].id,'s1');return {candidates:[{content:{parts:[{text:'Found Project [s1].'}]}}]};
  }});assert.equal(result.events.length,1);
});
test('browser actions and local chat work without a Gemini key',async t=>{
  const base=path.resolve('test-output'),dir=await fs.mkdtemp(path.join(base,'local-'));let opened,localCalls=0;
  const app=await createApp({port:0,dataDir:dir,platform:{openBrowserUrl:async(url,browser)=>{opened={url,browser}}},requestAI:async()=>{throw new Error('Cloud must not be called')},requestLocal:async()=>{localCalls++;return {candidates:[{content:{parts:[{text:'Hello Akshay.'}]}}]}}});
  t.after(async()=>{await app.close();assert.ok(dir.startsWith(base+path.sep));await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})});
  const headers={Origin:app.origin,'X-Grim-Client':'dashboard','Content-Type':'application/json'};
  const paired=await fetch(app.origin+'/api/session',{method:'POST',headers,body:JSON.stringify({token:app.token})});headers.Cookie=paired.headers.get('set-cookie').split(';')[0];
  const post=async(url,data)=>{const response=await fetch(app.origin+url,{method:'POST',headers,body:JSON.stringify(data)});assert.equal(response.status,200);return response.json()};
  await post('/api/settings',{provider:'local',localModel:'qwen3:1.7b'});
  const result=await post('/api/chat',{message:'open Brave and search for YouTube'});assert.equal(result.local,true);assert.equal(opened.browser,'brave');assert.equal(new URL(opened.url).searchParams.get('q'),'YouTube');assert.equal(localCalls,0);
  assert.equal((await post('/api/chat',{message:'Hello'})).text,'Hello Akshay.');assert.equal(localCalls,1);
});
