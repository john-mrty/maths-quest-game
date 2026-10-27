const params=new URLSearchParams(location.search),embedded=params.get('embedded')==='1'&&window.parent!==window,token=params.get('token');
export function notify(type,data){if(embedded)window.parent.postMessage({source:'turbo-tables',token,type,data},location.origin);}
// A racer always belongs to a Maths Quest learner, including visits to old direct links.
if (!embedded) {
 location.replace(new URL('../?game=turbo-tables'+(['duo','retro'].includes(params.get('controls'))?'&controls=duo':''), location.href).href);
 await new Promise(() => {});
}
export const host=embedded?await new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{window.removeEventListener('message',receive);reject(new Error('Maths Quest did not initialise the game'));},15000);
 function receive(event){if(event.source!==window.parent||event.origin!==location.origin||event.data?.source!=='maths-quest'||event.data.token!==token||event.data.type!=='init')return;clearTimeout(timeout);window.removeEventListener('message',receive);resolve(event.data.data);}
 window.addEventListener('message',receive);notify('ready');
}):null;
window.addEventListener('error',()=>notify('error'));
window.addEventListener('unhandledrejection',()=>notify('error'));
