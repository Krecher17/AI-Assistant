import fs from 'node:fs';
const file='scripts/smoke-desktop.cjs';let code=fs.readFileSync(file,'utf8');
code=code.replace("let backend, win;","let backend, win;\napp.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');");
code=code.replace("if(mode==='webgl')","if(mode==='sprite'&&document.querySelector('.core-reticle canvas')?.dataset.sprite==='ready')").replace('Real 3D renderer failed to initialize','Animated Grim asset failed to initialize').replace('Smoke: real 3D renderer initialized','Smoke: animated Grim initialized');
const begin=code.indexOf('        const samples=Float32Array.from'),end=code.indexOf('        const load = src',begin);
if(begin>=0&&end>begin)code=code.slice(0,begin)+"        if(document.getElementById('enroll-voice'))throw new Error('Voice enrollment gate must be absent');\n        if(!document.getElementById('page-voice'))throw new Error('Voice settings are missing');\n"+code.slice(end);
code=code.replace("        const recognizer=new model.KaldiRecognizer(16000); recognizer.acceptWaveformFloat(new Float32Array(32000),16000); recognizer.remove(); model.terminate();",`        const recognizer=new model.KaldiRecognizer(16000);
        const waveforms=${JSON.stringify(['wake-calculator.wav','wake-notepad.wav'].map(name=>fs.readFileSync('.local/fixtures/'+name).toString('base64')))};
        const results=[];
        for(const encoded of waveforms){
          const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const context=new AudioContext({sampleRate:16000});
          const audio=await context.decodeAudioData(bytes.buffer);const samples=audio.getChannelData(0);await context.close();
          const text=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Wake transcription timed out')),20000);const listener=message=>{if(message.result?.text){clearTimeout(timer);recognizer.removeEventListener('result',listener);resolve(message.result.text)}};recognizer.on('result',listener);recognizer.acceptWaveformFloat(samples,16000);recognizer.acceptWaveformFloat(new Float32Array(16000),16000);recognizer.retrieveFinalResult()});
          results.push(text);
        }
        console.log('Smoke: successive synthetic wake results '+JSON.stringify(results));
        const {wakeCommand}=await import('/identity-core.mjs');
        if(!results.every(text=>wakeCommand(text).detected))throw new Error('Hey Grim did not transcribe as the wake phrase');
        recognizer.remove();model.terminate();`);
code=code.replace('speakerEnrollment:true','voiceGateRemoved:true,animatedCharacter:true');
fs.writeFileSync(file,code);
