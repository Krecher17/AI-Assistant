import fs from 'node:fs';
const file='README.md'; let text=fs.readFileSync(file,'utf8');
text=text.replace('File/app changes proposed by chat require clicking **Approve**.', 'File/app changes proposed by the model require clicking **Approve**. Direct user app-launch commands execute immediately against the Windows catalog.');
if(!text.includes('CORE_UPDATE.md'))text=text.replace('## Start on this laptop', 'The main dashboard now has a real **3D Grim core**, separate **Conversation** and **Installed apps** pages, local app launching, and streamed Gemini answers. See [CORE_UPDATE.md](CORE_UPDATE.md) for details.\n\n## Start on this laptop');
fs.writeFileSync(file,text);
