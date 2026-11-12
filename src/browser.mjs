import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launchUrl } from './windows.mjs';

const browserNames = { brave:'Brave', chrome:'Google Chrome', edge:'Microsoft Edge', firefox:'Firefox' };
const sites = { youtube:'https://www.youtube.com/', github:'https://github.com/', google:'https://www.google.com/', spotify:'https://open.spotify.com/', gmail:'https://mail.google.com/' };
export function browserIntent(value) {
  let text=String(value).trim().replace(/^(?:please\s+)/i,'').replace(/[.!?]+$/,'');
  let browser=null, match;
  match=/^(?:open|launch|start)\s+(brave|chrome|google chrome|edge|microsoft edge|firefox)(?:\s+browser)?\s+(?:and\s+)?(?:then\s+)?(.+)$/i.exec(text);
  if(match){browser=match[1].toLowerCase().replace(/^google |^microsoft /,'');text=match[2]}
  else {
    match=/^(.+?)\s+(?:in|using|with|on)\s+(brave|chrome|edge|firefox)(?:\s+browser)?$/i.exec(text);
    if(match){text=match[1];browser=match[2].toLowerCase()}
  }
  match=/^(?:search|serch|google|look up|find online)(?:\s+(?:for|about))?\s+(.+)$/i.exec(text);
  if(match){
    const query=match[1].trim();if(!query||query.length>2000)return null;
    const target=/^(youtube|github)\s+for\s+(.+)$/i.exec(query);
    const url=target ? (target[1].toLowerCase()==='youtube'?'https://www.youtube.com/results?search_query=':'https://github.com/search?q=')+encodeURIComponent(target[2]) : 'https://www.google.com/search?q='+encodeURIComponent(query);
    return {kind:'search',browser,query,url};
  }
  match=/^(?:open|visit|go to|navigate to)\s+(.+)$/i.exec(text);
  if(match){const target=match[1].trim(),known=sites[target.toLowerCase()];
    if(known)return {kind:'website',browser,query:target,url:known};
    if(/^(?:https:\/\/)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(target)){
      const url=new URL(target.startsWith('https://')?target:'https://'+target);if(url.protocol==='https:'&&!url.username&&!url.password)return {kind:'website',browser,query:target,url:url.href};
    }
  }
  return null;
}
export async function findBrowser(browser) {
  const roots=[process.env.LOCALAPPDATA,process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean);
  const suffix={brave:'BraveSoftware/Brave-Browser/Application/brave.exe',chrome:'Google/Chrome/Application/chrome.exe',edge:'Microsoft/Edge/Application/msedge.exe',firefox:'Mozilla Firefox/firefox.exe'}[browser];
  if(!suffix)throw new Error('Choose Brave, Chrome, Edge, or Firefox.');
  for(const root of roots){const candidate=path.join(root,suffix);try{await fs.access(candidate);return candidate}catch{}}
  throw new Error(`${browserNames[browser]} is not installed in a standard application folder.`);
}
export async function openBrowserUrl(url,browser=null) {
  const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password)throw new Error('Only HTTPS web addresses are supported.');
  if(!browser)return launchUrl(target.href);
  const executable=await findBrowser(browser);
  await new Promise((resolve,reject)=>{
    // This is the interactive app the user asked to see, not a hidden helper.
    const child=spawn(executable,['--new-tab',target.href],{shell:false,detached:true,windowsHide:false,stdio:'ignore'});
    const timer=setTimeout(()=>{child.unref();resolve()},600);
    child.once('error',error=>{clearTimeout(timer);reject(error)});
    child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`${browserNames[browser]} could not open the page (exit ${code}).`))});
  });
}
export async function runBrowserIntent(intent,launch=openBrowserUrl) {
  await launch(intent.url,intent.browser);
  return {opened:true,url:intent.url,browser:intent.browser,query:intent.query,message:intent.kind==='search'?`Searching for ${intent.query}${intent.browser?' in '+browserNames[intent.browser]:''}.`:`Opening ${intent.query}${intent.browser?' in '+browserNames[intent.browser]:''}.`};
}
