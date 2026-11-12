import path from 'node:path';
import fs from 'node:fs/promises';
import { powershell } from '../src/windows.mjs';
await fs.mkdir('.local/fixtures',{recursive:true});
for(const[name,text]of[['wake-calculator.wav','Hey Grim. Open calculator.'],['wake-notepad.wav','Hey Grim. Open notepad.'],['wake-only.wav','Hey Grim.'],['command-only.wav','Open calculator.'],['ordinary.wav','Please open the calculator.']]){
  await powershell("$null=[Reflection.Assembly]::LoadWithPartialName('System.Speech'); $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $en=$s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1; if($en){$s.SelectVoice($en.VoiceInfo.Name)}; $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono); $s.SetOutputToWaveFile($d.path,$format);$s.Speak($d.text) } finally {$s.Dispose()}",{path:path.resolve('.local/fixtures',name),text});
}
console.log('Two synthetic wake-command WAV fixtures generated locally. No microphone was used.');
