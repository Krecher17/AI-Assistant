import fs from 'node:fs';
const file='public/index.html';let html=fs.readFileSync(file,'utf8');
if(!html.includes('id="test-speaker"'))html=html.replace('<button id="test-microphone"','<button id="test-speaker" class="button secondary" type="button">Test speaker</button><button id="test-microphone"');
fs.writeFileSync(file,html);
