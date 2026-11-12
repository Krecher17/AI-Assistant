import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrateLegacyProfile } from '../src/migration.mjs';
import { Store } from '../src/store.mjs';
import { spriteRect, POSES } from '../public/grim-sprites.mjs';
import { validateVoice } from '../src/voice.mjs';
import { wakeCommand } from '../public/identity-core.mjs';
const base=path.resolve('test-output');await fs.mkdir(base,{recursive:true});const dirs=[];
after(async()=>{for(const dir of dirs){assert.ok(dir.startsWith(base+path.sep));await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})}});
test('Grim wake phrase does not depend on a speaker profile and rejects old wake names',()=>{
  assert.equal(wakeCommand('hey grim open calculator').command,'open calculator');
  assert.equal(wakeCommand('hey grimm').detected,true);
  assert.equal(wakeCommand('hey creature open calculator').detected,false);
  assert.equal(wakeCommand('someone said hey grim').detected,false);
});
test('all 32 animation frames fit the transparent atlas',()=>{
  for(const pose of Object.keys(POSES))for(let frame=0;frame<4;frame++){const r=spriteRect(pose,frame,1774,887);assert.ok(r.x>=0&&r.y>=0);assert.ok(r.x+r.width<=1774);assert.ok(r.y+r.height<=887)}
});
test('voice settings accept explicit engines and bounded playback preferences',()=>{
  assert.equal(validateVoice({engine:'windows',name:'Microsoft David Desktop',rate:1,volume:80,elevenlabsVoiceId:''}).name,'Microsoft David Desktop');
  assert.throws(()=>validateVoice({engine:'shell',name:'',rate:0,volume:90,elevenlabsVoiceId:''}),/Choose Windows/);
  assert.throws(()=>validateVoice({engine:'windows',name:'',rate:50,volume:90,elevenlabsVoiceId:''}),/Invalid voice rate/);
});
test('rename migration preserves SQLite records and encrypted credentials without deleting the old profile',async()=>{
  const dir=await fs.mkdtemp(path.join(base,'migration-'));dirs.push(dir);const legacy=path.join(dir,'legacy'),target=path.join(dir,'Grim');await fs.mkdir(legacy);
  const db=new DatabaseSync(path.join(legacy,'krecher.sqlite'));
  db.exec('CREATE TABLE records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL); CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.prepare('INSERT INTO records VALUES(?,?,?,?)').run('m1','memory',JSON.stringify({text:'My project',category:'project'}),new Date().toISOString());
  db.prepare('INSERT INTO config VALUES(?,?)').run('geminiKey',JSON.stringify('encrypted-test-credential'));db.close();
  assert.equal(await migrateLegacyProfile(legacy,target),true);const store=new Store(target);
  try{assert.equal(store.list('memory')[0].text,'My project');assert.equal(store.config('geminiKey'),'encrypted-test-credential')}finally{store.close()}
  assert.equal(await migrateLegacyProfile(legacy,target),false);await fs.access(path.join(legacy,'krecher.sqlite'));
});
