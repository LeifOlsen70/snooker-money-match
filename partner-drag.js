(() => {
  'use strict';
  function bind(container,onSwap){
    const inputs=Array.from(container.querySelectorAll('input[name="player"]'));
    const removers=[];let gesture=null,ghost=null,target=null,suppressClickUntil=0;
    const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);removers.push(()=>el.removeEventListener(name,fn,options));};
    function clear(){
      if(gesture)clearTimeout(gesture.timer);
      gesture?.input.classList.remove('partnerDragSource');
      target?.classList.remove('partnerDropTarget');target=null;
      ghost?.remove();ghost=null;gesture=null;
    }
    function locate(x,y){
      const hit=document.elementFromPoint(x,y);
      const next=inputs.includes(hit)&&hit!==gesture?.input?hit:null;
      if(next!==target){target?.classList.remove('partnerDropTarget');target=next;target?.classList.add('partnerDropTarget');}
      if(ghost){ghost.style.left=x+'px';ghost.style.top=y+'px';}
    }
    for(const input of inputs){
      input.readOnly=true;
      listen(input,'blur',()=>{input.readOnly=true;});
      listen(input,'click',e=>{
        if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();return;}
        if(input.readOnly)input.blur();input.readOnly=false;input.focus();
      });
      listen(input,'keydown',e=>{if(e.key==='Enter'||e.key==='F2'){e.preventDefault();input.readOnly=false;input.focus();}if(e.key==='Escape')input.blur();});
      listen(input,'contextmenu',e=>{if(input.readOnly||gesture)e.preventDefault();});
      listen(input,'pointerdown',e=>{
        if(e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
        clear();
        const g=gesture={input,id:e.pointerId,x:e.clientX,y:e.clientY,active:false};
        input.setPointerCapture?.(e.pointerId);
        g.timer=setTimeout(()=>{
          if(gesture!==g)return;
          g.active=true;input.blur();input.classList.add('partnerDragSource');
          ghost=document.createElement('div');ghost.className='partnerDragGhost';ghost.textContent=input.value||'Freier Partnerplatz';document.body.append(ghost);
          locate(g.x,g.y);
        },450);
      });
      listen(input,'pointermove',e=>{
        const g=gesture;if(!g||g.id!==e.pointerId)return;
        if(!g.active){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>10)clear();return;}
        e.preventDefault();locate(e.clientX,e.clientY);
      },{passive:false});
      listen(input,'pointerup',e=>{
        const g=gesture;if(!g||g.id!==e.pointerId)return;
        if(g.active){
          e.preventDefault();suppressClickUntil=Date.now()+600;locate(e.clientX,e.clientY);
          if(target){const other=target;[input.value,other.value]=[other.value,input.value];clear();onSwap();return;}
        }
        clear();
      });
      listen(input,'pointercancel',clear);listen(input,'lostpointercapture',clear);
    }
    return ()=>{clear();for(const remove of removers)remove();};
  }
  window.ClubPartnerDrag=Object.freeze({bind});
})();
