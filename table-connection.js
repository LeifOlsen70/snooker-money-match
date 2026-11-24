// Used by the normal app and spectator page. Claim + membership are atomic.
export function createTableConnection({auth,db,doc,getDoc,runTransaction,signInAnonymously,signOut,pool,storage,onJoined,onLeft}){
  const key=pool?'pool-table-code-device-v1':'snooker-table-code-device-v2',tables=pool?'poolTables':'tables';
  const setup=()=>{try{return JSON.parse(storage.getItem(key))}catch{return null}};
  async function join(code){
    const token=String(code).trim().replace(/\s/g,'');
    if(!/^\d{4}$/.test(token))throw Error('Bitte genau vier Ziffern eingeben, zum Beispiel 0427.');
    const previous=setup();
    if(previous&&previous.token!==token)throw Error('Dieses Gerät ist bereits mit einem Tisch verbunden. Bitte diesen zuerst trennen.');
    if(!auth.currentUser)await signInAnonymously(auth);
    const inviteRef=doc(db,'snookerTableInvites',token),invite=(await getDoc(inviteRef)).data();
    if(!invite)throw Error('Tischcode nicht gefunden.');
    if((invite.sport==='pool')!==pool)throw Error('Dieser Code gehört zum anderen Spielbereich. Bitte dort mit dem Tischcode beitreten.');
    const uid=auth.currentUser.uid,memberRef=doc(db,'snookerTableBoards',invite.owner,tables,String(invite.slot),'members',uid);
    try{
      await runTransaction(db,async tx=>{
        const current=(await tx.get(inviteRef)).data();
        if(!current||current.owner!==invite.owner||current.slot!==invite.slot||current.generation!==invite.generation)throw Error('Dieser Tischcode ist abgelaufen oder das Turnier beendet.');
        if(current.claimedBy&&current.claimedBy!==uid)throw Error('Dieser Tischcode ist bereits mit einem anderen Gerät verbunden. Bitte zuerst das Tischgerät trennen.');
        if(!current.claimedBy)tx.update(inviteRef,{claimedBy:uid});
        tx.set(memberRef,{token,generation:current.generation});
      });
    }catch(err){if(err.code==='permission-denied')throw Error('Tischzugriff abgelehnt. Bitte aktuellen Code und Firebase-Regeln prüfen.');throw err;}
    const value={owner:invite.owner,slot:invite.slot,token,generation:invite.generation,tournamentKey:invite.tournamentKey};
    storage.setItem(key,JSON.stringify(value));await onJoined?.(value);return value;
  }
  async function leave(){
    const current=setup(),uid=auth.currentUser?.uid;
    if(current&&uid)await runTransaction(db,async tx=>{
      const inviteRef=doc(db,'snookerTableInvites',current.token),memberRef=doc(db,'snookerTableBoards',current.owner,tables,String(current.slot),'members',uid);
      const invite=(await tx.get(inviteRef)).data();
      if(invite?.owner===current.owner&&invite.slot===current.slot&&invite.claimedBy===uid&&(!current.generation||invite.generation===current.generation)){
        const {claimedBy,...released}=invite;tx.set(inviteRef,released);
      }
      tx.delete(memberRef);
    });
    storage.removeItem(key);await signOut(auth);await onLeft?.();
  }
  return Object.freeze({join,leave,setup});
}
