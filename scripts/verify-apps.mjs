import { AppCatalog } from '../src/apps.mjs';
import { powershell } from '../src/windows.mjs';
const catalog = new AppCatalog(); const apps = await catalog.list();
console.log(JSON.stringify({ registeredApps: apps.length, calculatorRegistered: apps.some(app => app.name === 'Calculator') }));
console.log(JSON.stringify(await catalog.open('Calculator')));
const voices = await powershell("$null=[Reflection.Assembly]::LoadWithPartialName('System.Speech'); $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { @($s.GetInstalledVoices()).Count } finally { $s.Dispose() }");
console.log(JSON.stringify({ windowsVoices: Number(voices) }));
