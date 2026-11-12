import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { localModelStatus } from './ollama.mjs';
export async function ensureOllama(root){
  if((await localModelStatus()).running)return;
  const executable=path.join(root,'.local/ollama/ollama.exe');if(!fs.existsSync(executable))return;
  const logs=path.join(root,'.local');fs.mkdirSync(logs,{recursive:true});
  const out=fs.openSync(path.join(logs,'ollama.log'),'a');
  const child=spawn(executable,['serve'],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',out,out],env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:path.join(process.env.LOCALAPPDATA||root,'Grim/models/ollama'),OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_NO_CLOUD:'1'}});
  child.on('error',()=>{});child.unref();fs.closeSync(out);
}
export class LocalSpeech {
  constructor(root){this.root=root;this.pending=new Map();this.sequence=0;this.child=null;this.starting=null}
  ready(){
    if(this.starting)return this.starting;
    const python=path.join(this.root,'.local/speech-venv/Scripts/python.exe'),model=path.join(this.root,'.local/models/whisper-base.en');
    if(!fs.existsSync(python)||!fs.existsSync(path.join(model,'model.bin')))return Promise.reject(new Error('Local speech model is missing. Run local model setup.'));
    this.starting=new Promise((resolve,reject)=>{
      const child=spawn(python,['-u',path.join(this.root,'scripts/local-speech.py'),model],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'}});this.child=child;
      const timer=setTimeout(()=>{this.close();reject(new Error('Local speech model did not start.'))},45000);this.startupTimer=timer;let buffer='';
      child.stdout.on('data',bytes=>{buffer+=bytes.toString();let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const data=JSON.parse(line);if(data.ready){clearTimeout(timer);resolve();continue}const entry=this.pending.get(data.id);if(entry){clearTimeout(entry.timer);this.pending.delete(data.id);data.error?entry.reject(new Error(data.error)):entry.resolve(data.text)}}catch{}}});
      child.on('error',error=>{clearTimeout(timer);reject(error)});
      child.on('exit',()=>{clearTimeout(timer);this.child=null;this.starting=null;reject(new Error('Local speech worker stopped.'));for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(new Error('Local speech worker stopped.'))}this.pending.clear()});
      child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
    });return this.starting;
  }
  async transcribe(bytes){await this.ready();return new Promise((resolve,reject)=>{const id=++this.sequence,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Local speech transcription timed out.'))},45000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,audio:bytes.toString('base64')})+'\n')})}
  close(){
    clearTimeout(this.startupTimer);
    const child=this.child;if(!child)return;
    child.stdin.end();child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();
    // Windows venv launchers may have a second Python process. Stop this worker's
    // own tree, rather than leaving its decoder waiting on an inherited pipe.
    if(process.platform==='win32'){
      const stop=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32/taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});stop.on('error',()=>child.kill());
    }else child.kill();
  }
}
