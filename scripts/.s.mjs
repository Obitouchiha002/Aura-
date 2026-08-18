const { evalInPage, close } = await import('./.cdp.mjs');
await evalInPage(`(function(){ location.hash='chat'; return 1; })()`);
await new Promise(r=>setTimeout(r,3000));
console.log('native taken over?:', await evalInPage('!!window.__auraNativeKb'));
console.log('note:', await evalInPage('window.__auraKbNote||"-"'));
const g = await evalInPage(`(function(){var e=document.querySelector('textarea');var b=e.getBoundingClientRect();
 return Math.round(b.x+b.width/2)+','+Math.round(b.y+b.height/2)+','+devicePixelRatio;})()`);
console.log('composer:', g);
close();
