import { wakeCommand, joinAudio, rms, SpeechEndpoint } from './identity-core.mjs';
import { preferredDevice, selectableCamera, inputConstraints } from './devices.mjs';
const $ = id => document.getElementById(id);
let profile=null,devices=[],model=null,recognizer=null,mic=null,armed=false,loading=false,mode='dormant',turnOpen=false,holdUntil=0,lastLevel=0,lastAudioAt=0,meterAt=0,endpoint=new SpeechEndpoint(),commandTimer,engineGeneration=0;
let camera=null,cameraTimer=null,faceBusy=false,human=null,faceGeneration=0,knownUntil=0;
const native=window.grimDesktop;
let wakeHasCommand=false,wakeRecognizer=null,wakeCandidate=false,wakeTimer,commandRecorder=null,commandChunks=[],commandEnergy=null,recordedMs=0,commandAudioAt=0;
function markWake(text,final=false){if(mode!=='standby'||!wakeCommand(text.replace(/\[unk\]/g,'').trim()).detected)return;wakeCandidate=true;wakeHasCommand ||= /grim(?:m)?\s+\[unk\]/.test(text);$('last-heard').textContent='Local wake detector: '+text;if(!final)return;clearTimeout(wakeTimer);wakeTimer=setTimeout(()=>{if(mode==='standby'&&wakeCandidate){wakeCandidate=false;queueTranscript('hey grim')}},150)}
function cancelCommandRecording(){const recording=commandRecorder;commandRecorder=null;commandChunks=[];if(recording&&recording.state!=='inactive'){recording.onstop=null;recording.stop()}}
function startCommandRecording(){
  if(!window.grimAssistant?.data()?.keyConfigured||!mic)return;
  cancelCommandRecording();commandChunks=[];commandEnergy=new SpeechEndpoint(1000);recordedMs=0;commandAudioAt=Date.now()+450;
  const recorder=new MediaRecorder(mic.stream);commandRecorder=recorder;
  recorder.ondataavailable=event=>{if(event.data.size)commandChunks.push(event.data)};
  recorder.onstop=()=>{if(commandRecorder!==recorder)return;const chunks=commandChunks;commandRecorder=null;commandChunks=[];attempt(async()=>{
    phase('working','Understanding your voice command…');
    try{const audio=new Blob(chunks,{type:recorder.mimeType});const response=await fetch('/api/transcribe?mode=dictation',{method:'POST',headers:{'X-Grim-Client':'dashboard','Content-Type':audio.type},body:audio});const data=await response.json();if(!response.ok)throw new Error(data.error||'Voice transcription failed.');if(!armed)return;const text=data.text?.trim();if(!text)throw new Error('I could not hear a command. Say Hey Grim and try again.');await command(wakeCommand(text).command||text)}catch(error){note(error.message,true);turnOpen=false;if(armed){await window.grimAssistant.speak(error.message).catch(()=>{});phase('standby','Say Hey Grim to try again.')}}
  })};
  recorder.start();
}
function commandAudio(buffer){if(!commandRecorder||mode!=='listening'||Date.now()<commandAudioAt)return;const ms=buffer.length/16;recordedMs+=ms;if(commandEnergy.push(rms(buffer),ms)||recordedMs>=15000){commandRecorder.stop();phase('working','Understanding your voice command…')}}

let utteranceHistory=[],lastSpeechAt=0,wakeQueueAt=0,utteranceAudio=[],lastUtterance=[],utteranceEndpoint=new SpeechEndpoint(1000);
function rememberUtterance(buffer){if(rms(buffer)>.0015)lastSpeechAt=Date.now();utteranceAudio.push(buffer);if(utteranceAudio.length>70)utteranceAudio.shift();if(utteranceEndpoint.push(rms(buffer),buffer.length/16)){lastUtterance=utteranceAudio;utteranceHistory.push({chunks:utteranceAudio,at:Date.now()});utteranceHistory=utteranceHistory.filter(part=>Date.now()-part.at<6000).slice(-3);utteranceAudio=[]}}
function wavAudio(chunks){const samples=joinAudio(chunks,240000),bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);const text=(at,value)=>{for(let i=0;i<value.length;i++)v.setUint8(at+i,value.charCodeAt(i))};text(0,'RIFF');v.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);return new Blob([bytes],{type:'audio/wav'})}
async function transcribeCommand(audio){const response=await fetch('/api/transcribe?mode=dictation',{method:'POST',headers:{'X-Grim-Client':'dashboard','Content-Type':audio.type},body:audio});const data=await response.json();if(!response.ok)throw new Error(data.error||'Voice transcription failed.');return data.text?.trim()||''}
let pendingTranscript='', transcriptTimer;
function flushTranscript(){if(pendingTranscript&&window.grimAssistant?.data()?.keyConfigured&&Date.now()-lastSpeechAt<900&&Date.now()-wakeQueueAt<3500){transcriptTimer=setTimeout(flushTranscript,100);return}const text=pendingTranscript;pendingTranscript='';if(text&&!commandRecorder)attempt(()=>heard(text))}
function queueTranscript(text){if(!pendingTranscript)wakeQueueAt=Date.now();pendingTranscript=wakeCommand(text).detected?text:[pendingTranscript,text].filter(Boolean).join(' ');clearTimeout(transcriptTimer);transcriptTimer=setTimeout(flushTranscript,window.grimAssistant?.data()?.keyConfigured?100:800)}
async function request(url,data,method='POST'){
  const response=await fetch(url,{method,headers:{'X-Grim-Client':'dashboard','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data||{})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;
}
function note(text,error=false){$('identity-feedback').textContent=text;$('identity-feedback').classList.toggle('danger',error);$('voice-diagnostic').textContent=text}
async function attempt(action){try{return await action()}catch(error){note(error.message,true);if(armed&&turnOpen)await window.grimAssistant?.speak(error.message).catch(()=>{})}}
function phase(next,message){
  mode=next;document.body.dataset.assistantState=next;$('core-state').textContent=next.toUpperCase();$('assistant-status').textContent=message;
  $('wake-toggle').textContent=loading?'Loading local wake engine…':armed?'Pause “Hey Grim”':'Enable “Hey Grim”';$('wake-toggle').disabled=loading;
  $('mic-indicator').textContent=armed?'MIC LIVE · LOCAL WAKE DETECTION':'MIC OFF';
  native?.setCompanion({phase:next,message});
}
async function refreshDevices(){
  try{devices=await navigator.mediaDevices.enumerateDevices()}catch(error){if(!document.hidden)throw error;return}
  for(const[id,kind,key]of[['microphone-device','audioinput','grim-microphone'],['camera-device','videoinput','grim-camera']]){
    const select=$(id),chosen=preferredDevice(devices,kind,localStorage.getItem(key)||'');select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=kind==='videoinput'?'Choose laptop Integrated Webcam':'Choose microphone';select.append(placeholder);
    devices.filter(d=>d.kind===kind&&!['default','communications'].includes(d.deviceId)).forEach((d,i)=>{const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||`Device ${i+1}`;if(kind==='videoinput'&&!selectableCamera(d)){option.disabled=true;option.textContent+=' — phone / virtual / IR excluded'}select.append(option)});
    if(chosen){select.value=chosen.deviceId;localStorage.setItem(key,chosen.deviceId)}
  }
}
window.grimMedia={audioConstraints:()=>inputConstraints(localStorage.getItem('grim-microphone')||'')};
function loadScript(src,name){if(window[name])return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Local recognition engine could not load. Restart Grim.'));document.head.append(script)})}
async function capture(onBuffer){
  await refreshDevices();const stream=await navigator.mediaDevices.getUserMedia({audio:window.grimMedia.audioConstraints(),video:false});let context;
  try{
    context=new AudioContext({sampleRate:16000});await context.resume();if(context.sampleRate!==16000)throw new Error('Choose a microphone supporting 16 kHz audio.');
    const input=context.createMediaStreamSource(stream),node=context.createScriptProcessor(4096,1,1);lastLevel=0;lastAudioAt=performance.now();
    $('active-microphone').textContent='Input: '+(stream.getAudioTracks()[0]?.label||'microphone');
    node.onaudioprocess=event=>{const buffer=Float32Array.from(event.inputBuffer.getChannelData(0)),level=rms(buffer);lastAudioAt=performance.now();lastLevel=Math.max(lastLevel,level);
      if(!document.hidden&&window.grimDashboardVisible!==false&&(!$('page-identity').classList.contains('hidden')||!$('page-core').classList.contains('hidden'))&&performance.now()-meterAt>200){meterAt=performance.now();const db=20*Math.log10(level||.000001),normalized=Math.max(0,Math.min(1,(db+70)/60));$('microphone-level').value=normalized;$('microphone-level-text').textContent=level?`${Math.round(db)} dBFS`:'No signal';window.dispatchEvent(new CustomEvent('grim-audio-level',{detail:normalized}))}
      onBuffer(buffer)};
    input.connect(node);node.connect(context.destination);
    return{stream,context,stop:async()=>{node.onaudioprocess=null;node.disconnect();input.disconnect();stream.getTracks().forEach(t=>t.stop());await context.close();$('microphone-level').value=0}};
  }catch(error){stream.getTracks().forEach(t=>t.stop());if(context)await context.close();throw error}
}
async function pause(remember=true){engineGeneration++;armed=false;turnOpen=false;clearTimeout(commandTimer);clearTimeout(wakeTimer);wakeCandidate=false;utteranceHistory=[];utteranceAudio=[];lastUtterance=[];cancelCommandRecording();clearTimeout(transcriptTimer);pendingTranscript='';wakeRecognizer?.remove();wakeRecognizer=null;recognizer?.remove();recognizer=null;if(mic)await mic.stop();mic=null;if(remember)localStorage.setItem('grim-wake-enabled','false');phase('dormant','Resting at your cursor. The microphone is off.')}
async function arm(){
  if(armed)return pause();if(loading)return;const generation=++engineGeneration;loading=true;phase('loading','Loading the local “Hey Grim” engine…');
  try{
    await loadScript('/vendor/vosk.js','Vosk');if(!model)model=await Vosk.createModel(location.origin+'/models/wake-en.tar.gz',-2);
    if(generation!==engineGeneration)return;
    if(!window.grimAssistant?.data()?.keyConfigured){recognizer=new model.KaldiRecognizer(16000);recognizer.setWords(false)}
    wakeRecognizer=new model.KaldiRecognizer(16000,JSON.stringify(['hey grim','hey grimm','[unk]']));
    wakeRecognizer.on('partialresult',message=>markWake(message.result?.partial||''));
    wakeRecognizer.on('result',message=>markWake(message.result?.text||'',true));
    model.on('error',()=>{note('Local speech engine failed. Pause and enable wake listening again.',true);native?.voiceError('Local speech engine failed.')});
    recognizer?.on('partialresult',message=>{if(message.result?.partial){if(pendingTranscript){clearTimeout(transcriptTimer);transcriptTimer=setTimeout(flushTranscript,1000)}$('last-heard').textContent='Local speech (not saved): '+message.result.partial.slice(0,160)}});
    recognizer?.on('result',message=>{const text=message.result?.text||'';if(text)$('last-heard').textContent='Local speech (not saved): '+text.slice(0,160);if(commandRecorder)return;if(text&&(mode==='listening'||pendingTranscript||wakeCommand(text).detected)){wakeCandidate=false;clearTimeout(wakeTimer);$('last-heard').textContent='Heard: '+text.slice(0,160);queueTranscript(text)}else if(text&&wakeCandidate){wakeCandidate=false;clearTimeout(wakeTimer);queueTranscript('hey grim')}});
    mic=await capture(buffer=>{if(!armed)return;if(mode==='standby')rememberUtterance(buffer);commandAudio(buffer);if(Date.now()>=holdUntil&&['standby','listening'].includes(mode)&&!window.grimAssistant?.busy()){if(!window.grimAssistant?.data()?.keyConfigured)recognizer?.acceptWaveformFloat(buffer,16000);if(mode==='standby')wakeRecognizer?.acceptWaveformFloat(buffer,16000)}});
    if(generation!==engineGeneration){await mic.stop();mic=null;return}
    mic.stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(armed){note('Microphone disconnected. Select its input and enable Grim again.',true);attempt(()=>pause(false))}}));
    armed=true;endpoint=new SpeechEndpoint();localStorage.setItem('grim-wake-enabled','true');phase('standby','At your cursor. Say “Hey Grim” to wake me.');note('Ready. No voice enrollment or speaker matching is required.');
  }catch(error){await pause(false);note(error.message,true);native?.voiceError(error.message)}finally{loading=false;$('wake-toggle').disabled=false;$('wake-toggle').textContent=armed?'Pause “Hey Grim”':'Enable “Hey Grim”'}
}
async function greeting(){
  if(Date.now()<knownUntil)return'Yes, Akshay.';
  if(localStorage.getItem('grim-face-on-wake')==='true'&&profile?.faceSamples){
    const alreadyOpen=!!camera;try{await startCamera();const vector=await faceVector(),match=await request('/api/identity/face/verify',{vector});if(match.matched){knownUntil=Date.now()+30000;return'Yes, Akshay.'}}catch(error){note('Face greeting skipped: '+error.message)}finally{if(!alreadyOpen)stopCamera()}
  }
  return'Yes? I’m here.';
}
async function heard(text){
  if(!armed||Date.now()<holdUntil||window.grimAssistant?.busy())return;
  if(mode==='standby'){
    const wake=wakeCommand(text);if(!wake.detected)return;
    const wakeAudio=[...utteranceHistory.filter(part=>Date.now()-part.at<6000).flatMap(part=>part.chunks),...utteranceAudio];utteranceHistory=[];const hasCommand=wakeHasCommand||!!wake.command||wakeAudio.reduce((ms,b)=>ms+(rms(b)>.0015?b.length/16:0),0)>1250;wakeHasCommand=false;utteranceAudio=[];lastUtterance=[];utteranceEndpoint=new SpeechEndpoint(1000);
    turnOpen=true;phase('waking','Grim is waking from your cursor…');
    const hello=await greeting();await window.grimAssistant.speak(hello).catch(error=>note(error.message,true));
    if(!armed)return;
    if(hasCommand){
      if(window.grimAssistant?.data()?.keyConfigured&&wakeAudio.length){
        phase('working','Understanding your voice command…');
        try{const transcript=await transcribeCommand(wavAudio(wakeAudio));if(!armed)return;if(!transcript)throw new Error('I could not hear a command. Please try again.');const parsed=wakeCommand(transcript);if(parsed.detected&&!parsed.command){turnOpen=true;holdUntil=Date.now()+350;phase('listening','Listening. What would you like me to do?');startCommandRecording();clearTimeout(commandTimer);commandTimer=setTimeout(()=>{cancelCommandRecording();turnOpen=false;if(armed)phase('standby','Say Hey Grim for another task.')},20000);return}return command(parsed.command||transcript)}catch(error){turnOpen=false;note(error.message,true);await window.grimAssistant.speak(error.message).catch(()=>{});if(armed)phase('standby','Say Hey Grim to try again.');return}
      }
      if(wake.command)return command(wake.command);
    }
    holdUntil=Date.now()+350;phase('listening','Listening. What would you like me to do?');startCommandRecording();
    clearTimeout(commandTimer);commandTimer=setTimeout(()=>{if(armed&&mode==='listening'){cancelCommandRecording();turnOpen=false;phase('standby','Back at your cursor. Say “Hey Grim” when you need me.')}},20000);
  }else if(mode==='listening'){await command(wakeCommand(text).command||text)}
}
async function command(text){
  clearTimeout(commandTimer);clearTimeout(wakeTimer);wakeCandidate=false;cancelCommandRecording();turnOpen=false;
  if(/^(stop listening|go to sleep|pause listening)$/.test(text.toLowerCase().replace(/[.!?]+$/,'').trim())){await pause();await window.grimAssistant.speak('Resting now. You can enable me again from the tray.').catch(()=>{});return}
  phase(/search|read|mail|code|analy|find|summari/.test(text)?'working':'thinking','On it.');$('last-command').textContent=text;
  try{
    const result=await window.grimAssistant.sendCommand(text);
    if(result?.events?.some(e=>e.result?.pending))native?.setCompanion({phase:'waiting',message:'Please review this action in the dashboard.'});
    else native?.setCompanion({phase:'success',message:result?.text?.slice(0,200)||'Done.'});
  }catch(error){note(error.message,true);native?.setCompanion({phase:'error',message:error.message});await window.grimAssistant.speak(error.message).catch(()=>{})}
  finally{holdUntil=Date.now()+800;if(armed)phase('standby','At your cursor. Say “Hey Grim” for another task.')}
}
window.addEventListener('grim-speaking',event=>{if(!armed)return;if(event.detail){holdUntil=Infinity;phase('speaking','Grim is speaking.')}else{holdUntil=Date.now()+500;phase(turnOpen?'listening':'standby',turnOpen?'Listening for your command.':'At your cursor. Say “Hey Grim”.')}});
window.addEventListener('grim-pause-wake',()=>{if(armed)attempt(()=>pause(false))});
$('wake-toggle').addEventListener('click',()=>attempt(arm));native?.onWakeControl(enabled=>attempt(()=>enabled?(!armed&&arm()):pause()));
$('refresh-devices').addEventListener('click',()=>attempt(async()=>{await refreshDevices();note('Choose the laptop Microphone Array and Integrated Webcam.')}));
$('microphone-device').addEventListener('change',()=>attempt(async()=>{const id=$('microphone-device').value;const restart=armed;if(restart)await pause(false);localStorage.setItem('grim-microphone',id);if(restart)await arm();note('Microphone selected. No enrollment is needed.')}));
$('camera-device').addEventListener('change',()=>{stopCamera();localStorage.setItem('grim-camera',$('camera-device').value)});
$('test-microphone').addEventListener('click',()=>attempt(async()=>{if(armed)await pause(false);let session;try{session=await capture(()=>{});note('Speak normally for five seconds. This test is local.');await new Promise(r=>setTimeout(r,5000));note(lastLevel>.0001?'Microphone signal received. Enable “Hey Grim” and try your command.':'No input signal. Select the laptop Microphone Array and check its mute key.',lastLevel<=.0001)}finally{if(session)await session.stop()}}));
async function startCamera(){
  if(camera)return;await refreshDevices();const id=$('camera-device').value||localStorage.getItem('grim-camera'),selected=devices.find(d=>d.deviceId===id&&d.kind==='videoinput');
  if(!selected||!selectableCamera(selected))throw new Error('Choose the laptop Integrated Webcam.');
  camera=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id},width:{ideal:640},height:{ideal:480}},audio:false});$('identity-camera').srcObject=camera;
  try{await $('identity-camera').play()}catch(error){stopCamera();throw error}$('camera-indicator').textContent='LIVE · '+(camera.getVideoTracks()[0]?.label||selected.label);$('stop-camera').disabled=false;
}
function stopCamera(){faceGeneration++;clearInterval(cameraTimer);cameraTimer=null;camera?.getTracks().forEach(t=>t.stop());camera=null;$('identity-camera').srcObject=null;$('camera-indicator').textContent='CAMERA OFF';$('stop-camera').disabled=true;knownUntil=0}
async function faceVector(){
  if(!human){await loadScript('/vendor/human.js','Human');const Engine=Human.Human||Human.default||Human;human=new Engine({backend:'webgl',modelBasePath:'/vendor/human/models/',cacheSensitivity:0,face:{enabled:true,detector:{maxDetected:2,rotation:true},mesh:{enabled:true},iris:{enabled:false},description:{enabled:true},emotion:{enabled:false}},body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false},segmentation:{enabled:false}});await human.load()}
  const result=await human.detect($('identity-camera'));if(result.face?.length!==1||!result.face[0].embedding?.length)throw new Error('Keep one clearly lit face in the laptop camera.');return Array.from(result.face[0].embedding);
}
$('enroll-face').addEventListener('click',()=>attempt(async()=>{if(faceBusy)return;faceBusy=true;const generation=++faceGeneration;$('enroll-face').disabled=true;try{await startCamera();note('Look at the laptop camera. Saving three local face references…');const vectors=[];for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,800));if(generation!==faceGeneration)throw new Error('Enrollment cancelled.');vectors.push(await faceVector())}profile=await request('/api/identity/face/enroll',{vectors});updateProfile(profile);note('Face profile saved. Recognition changes only the greeting, not access to commands.')}finally{stopCamera();faceBusy=false;$('enroll-face').disabled=false}}));
$('recognize-face').addEventListener('click',()=>attempt(async()=>{
  if(!profile?.faceSamples)throw new Error('Enroll your face first. Voice commands work without it.');await startCamera();let greeted=false;
  const check=async()=>{if(faceBusy||!camera)return;faceBusy=true;try{const vector=await faceVector();if(!camera)return;const match=await request('/api/identity/face/verify',{vector});if(!camera)return;knownUntil=match.matched?Date.now()+30000:0;$('recognized-person').textContent=match.matched?'AKSHAY · FACE RECOGNIZED':'FACE NOT RECOGNIZED';$('face-match-state').textContent=match.matched?'Grim recognizes you. The next wake greeting can say “Yes, Akshay.”':'No face match. Commands remain available.';if(match.matched&&!greeted&&!window.grimAssistant?.busy()){greeted=true;await window.grimAssistant.speak('Hello, Akshay.')}}catch(error){$('face-match-state').textContent=error.message}finally{faceBusy=false}};
  clearInterval(cameraTimer);cameraTimer=setInterval(check,2500);await check();
}));
$('stop-camera').addEventListener('click',stopCamera);
$('forget-face').addEventListener('click',()=>attempt(async()=>{if(!confirm('Forget the local face profile?'))return;stopCamera();await request('/api/identity/face',{},'DELETE');updateProfile(await request('/api/identity',undefined,'GET'));note('Face profile removed. Wake commands still work.')}));
$('face-on-wake').checked=localStorage.getItem('grim-face-on-wake')==='true';$('face-on-wake').addEventListener('change',()=>localStorage.setItem('grim-face-on-wake',$('face-on-wake').checked));
function updateProfile(data){profile=data.identity||data;$('face-profile-state').textContent=profile.faceSamples?'Local face profile enrolled':'Face not enrolled';$('wake-readiness').textContent=profile.wakeReady?'Say “Hey Grim” and your command. Voice enrollment is not required.':'Local wake model is missing. Run npm run setup:identity.'}
let autoStarted=false;
window.addEventListener('grim-state',event=>{updateProfile(event.detail);if(!devices.length)attempt(refreshDevices);if(!autoStarted){autoStarted=true;if(native&&localStorage.getItem('grim-wake-enabled')!=='false')attempt(arm)}});
if(window.grimAssistant?.data()){updateProfile(window.grimAssistant.data());if(native&&localStorage.getItem('grim-wake-enabled')!=='false'){autoStarted=true;attempt(arm)}}
setInterval(()=>{if(armed&&performance.now()-lastAudioAt>4000){mic?.context.resume().catch(()=>{});note('Microphone stream stalled. Pause and enable “Hey Grim” again.',true)}},3000);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&armed)attempt(()=>pause())});
window.addEventListener('beforeunload',()=>{mic?.stream.getTracks().forEach(t=>t.stop());stopCamera();model?.terminate()});
phase('dormant','Resting at your cursor. Say “Hey Grim” when enabled.');
