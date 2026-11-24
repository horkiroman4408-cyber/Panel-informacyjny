'use strict';
/* INCYDENTY: selectable font sizes in Tablica informacyjna. Existing editor remains unchanged. */
(()=>{
  const sizes=[16,20,24,28,32,36,40];
  let lastSelection=null;
  const preview=()=>document.getElementById('isaLivePreview');
  const choice=()=>document.getElementById('isaRichSize');
  function remember(){
    const s=window.getSelection();
    const r=s&&s.rangeCount?s.getRangeAt(0):null;
    if(!r||r.collapsed||!r.toString().trim())return;
    const card=(r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer:r.commonAncestorContainer.parentElement)?.closest('[data-edit-block]');
    if(card&&preview()?.contains(card))lastSelection={card,range:r.cloneRange()};
  }
  function getOffset(root,node,offset){
    const r=document.createRange();r.selectNodeContents(root);r.setEnd(node,offset);return r.toString().length;
  }
  function boundary(root,offset){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n,rest=offset,last=null;
    while((n=walker.nextNode())){last=n;if(rest<=n.length)return {node:n,offset:rest};rest-=n.length;}
    return last?{node:last,offset:last.length}:null;
  }
  function setSelection(card,start,end){
    const a=boundary(card,start),b=boundary(card,end);if(!a||!b)return;
    const r=document.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(r);
    lastSelection={card,range:r.cloneRange()};
  }
  function applySize(size){
    const saved=lastSelection;if(!saved?.card?.isConnected)return;
    const card=saved.card,range=saved.range;
    if(!card.contains(range.commonAncestorContainer)||range.collapsed)return;
    const start=getOffset(card,range.startContainer,range.startOffset),end=getOffset(card,range.endContainer,range.endOffset);
    if(end<=start)return;
    const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),parts=[];
    let n,pos=0;
    while((n=walker.nextNode())){
      const next=pos+n.length,a=Math.max(0,start-pos),b=Math.min(n.length,end-pos);
      if(a<b)parts.push({node:n,start:a,end:b});pos=next;
    }
    for(const part of parts.reverse()){
      let text=part.node;
      if(part.end<text.length)text.splitText(part.end);
      if(part.start>0)text=text.splitText(part.start);
      if(!text.nodeValue)continue;
      const wrap=document.createElement('span');wrap.style.fontSize=size+'px';
      text.replaceWith(wrap);wrap.append(text);
    }
    // The existing editor persists rich HTML on its native input event.
    card.dispatchEvent(new Event('input',{bubbles:true}));
    setSelection(card,start,end);
  }
  document.addEventListener('pointerdown',e=>{
    if(e.target.closest?.('#isaRichSize'))remember();
  },true);
  document.addEventListener('selectionchange',()=>{
    const active=document.activeElement;
    if(active?.closest?.('#isaLivePreview'))remember();
  });
  function install(){
    const select=choice();if(!select||select.dataset.preciseInstalled)return false;
    select.dataset.preciseInstalled='true';
    select.replaceChildren(...sizes.map(size=>{
      const opt=document.createElement('option');opt.value=String(size);opt.textContent=size+' px';return opt;
    }));
    select.value='28';
    select.setAttribute('aria-label','Rozmiar zaznaczonego tekstu w pikselach');
    // Native legacy listener only understands values 3,4,5. For numeric px values
    // it does nothing, so we handle selection and dispatch the editor input event.
    select.addEventListener('change',()=>{
      const n=Number(select.value);if(sizes.includes(n))applySize(n);
    });
    return true;
  }
  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer);},100);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();
