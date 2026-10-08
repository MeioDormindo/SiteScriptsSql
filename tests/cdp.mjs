// Cliente minimo do Chrome DevTools Protocol para o Edge headless: navegar, avaliar JS, teclas e cliques reais, screenshots.
import {spawn} from 'node:child_process';
import {rmSync,writeFileSync} from 'node:fs';
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VK={ArrowDown:40,ArrowUp:38,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Tab:9,F2:113,F6:117,F10:121,Delete:46,Home:36,End:35,PageUp:33,PageDown:34,' ':32,ContextMenu:93,Backspace:8};
const CODE={ArrowDown:'ArrowDown',ArrowUp:'ArrowUp',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Enter:'Enter',Escape:'Escape',Tab:'Tab',F2:'F2',F6:'F6',F10:'F10',Delete:'Delete',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',' ':'Space',ContextMenu:'ContextMenu',Backspace:'Backspace','/':'Slash','?':'Slash'};
export async function launch({port=9333,profile,width=1400,height=900,args=[]}){
  rmSync(profile,{recursive:true,force:true});
  const proc=spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars','--font-render-hinting=none',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${width},${height}`,...args,'about:blank'],{stdio:'ignore'});
  let targets=[];
  for(let i=0;i<150;i++){try{targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(t=>t.type==='page'))break}catch(e){}await sleep(100)}
  const page=targets.find(t=>t.type==='page');if(!page)throw new Error('no page target');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  let id=0;const pending=new Map(),listeners=new Set();const logs=[];
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result)}else if(m.method)listeners.forEach(l=>l(m))};
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}))});
  listeners.add(m=>{
    if(m.method==='Runtime.exceptionThrown')logs.push('EXCEPTION '+(m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description||m.params.exceptionDetails.text));
    if(m.method==='Runtime.consoleAPICalled'&&(m.params.type==='error'||m.params.type==='warning'))logs.push(m.params.type.toUpperCase()+' '+m.params.args.map(a=>a.value!==undefined?a.value:a.description).join(' '));
  });
  await send('Page.enable');await send('Runtime.enable');
  const api={
    send,logs,
    async goto(url){const done=new Promise(r=>{const l=m=>{if(m.method==='Page.loadEventFired'){listeners.delete(l);r()}};listeners.add(l)});await send('Page.navigate',{url});await done},
    async reload(){const done=new Promise(r=>{const l=m=>{if(m.method==='Page.loadEventFired'){listeners.delete(l);r()}};listeners.add(l)});await send('Page.reload',{ignoreCache:true});await done},
    async eval(expr){const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('eval: '+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+'\n  in: '+expr.slice(0,200));return r.result.value},
    async waitFor(expr,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){try{if(await api.eval(expr))return true}catch(e){}await sleep(50)}return false},
    async viewport(width,height,mobile=false){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await sleep(50)},
    async media(features){await send('Emulation.setEmulatedMedia',{features})},
    async shot(path){const r=await send('Page.captureScreenshot',{format:'png'});if(path)writeFileSync(path,Buffer.from(r.data,'base64'));return r.data},
    async key(key,mods={}){
      const m=(mods.alt?1:0)|(mods.ctrl?2:0)|(mods.meta?4:0)|(mods.shift?8:0);
      const printable=key.length===1;
      const vk=VK[key]||(printable?key.toUpperCase().charCodeAt(0):0);
      const code=CODE[key]||(printable&&/[a-z]/i.test(key)?'Key'+key.toUpperCase():'');
      const text=key==='Enter'?'\r':printable&&!(mods.ctrl||mods.meta||mods.alt)?key:undefined;
      await send('Input.dispatchKeyEvent',{type:text?'keyDown':'rawKeyDown',key,code,windowsVirtualKeyCode:key==='?'||key==='/'?191:vk,modifiers:m,text,unmodifiedText:text});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:key==='?'||key==='/'?191:vk,modifiers:m});
      await sleep(30);
    },
    async type(text){await send('Input.insertText',{text});await sleep(30)},
    async click(selector){
      const box=await api.eval(`(function(){var e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;var r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      if(!box)throw new Error('click: not found '+selector);
      for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});
      await sleep(40);
    },
    async close(){try{await send('Browser.close')}catch(e){}try{proc.kill()}catch(e){}}
  };
  return api;
}
