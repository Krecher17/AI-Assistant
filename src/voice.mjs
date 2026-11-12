import { powershell } from './windows.mjs';
let voices = null;
export const defaultVoice = { engine: 'windows', name: '', rate: 0, volume: 90, elevenlabsVoiceId: '' };
export async function windowsVoices() {
  if (voices) return voices;
  const result = await powershell("$null=[Reflection.Assembly]::LoadWithPartialName('System.Speech'); $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $v=@($s.GetInstalledVoices() | ForEach-Object { [pscustomobject]@{name=$_.VoiceInfo.Name; language=$_.VoiceInfo.Culture.Name; gender=$_.VoiceInfo.Gender.ToString()} }); ConvertTo-Json -InputObject $v -Compress } finally { $s.Dispose() }");
  voices = JSON.parse(result || '[]'); return voices;
}
export function validateVoice(value) {
  if (!['windows','browser','elevenlabs'].includes(value.engine)) throw new Error('Choose Windows, browser, or ElevenLabs speech.');
  if (!Number.isInteger(value.rate) || value.rate < -4 || value.rate > 4 || !Number.isInteger(value.volume) || value.volume < 0 || value.volume > 100) throw new Error('Invalid voice rate or volume.');
  if (typeof value.name !== 'string' || value.name.length > 150 || typeof value.elevenlabsVoiceId !== 'string' || !/^[a-zA-Z0-9_-]{0,100}$/.test(value.elevenlabsVoiceId)) throw new Error('Invalid voice selection.');
  return { engine: value.engine, name: value.name, rate: value.rate, volume: value.volume, elevenlabsVoiceId: value.elevenlabsVoiceId };
}
export async function speakWindows(text, settings = defaultVoice) {
  await powershell("$null=[Reflection.Assembly]::LoadWithPartialName('System.Speech'); $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { if($d.name){$s.SelectVoice($d.name)}; $s.Rate=[int]$d.rate; $s.Volume=[int]$d.volume; $s.Speak($d.text) } finally { $s.Dispose() }", { text, ...settings }, 90000);
}
