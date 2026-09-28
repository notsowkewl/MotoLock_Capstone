const fs = require('fs');
for (const path of process.argv.slice(2)) {
 const b = fs.readFileSync(path);
 const u = p => b.readUInt32LE(p), i = p => b.readInt32LE(p);
 const field = (t, n) => { const v=t-i(t), o=4+2*n; return o<b.readUInt16LE(v) && b.readUInt16LE(v+o) ? t+b.readUInt16LE(v+o):0; };
 const ref = p => p ? p+u(p):0;
 const vec = (t,n) => { const p=ref(field(t,n)); return p ? Array.from({length:u(p)},(_,j)=>p+4+j*4):[]; };
 const str = p => { const s=ref(p); return s?b.toString('utf8',s+4,s+4+u(s)):''; };
 const root=u(0), sg=ref(vec(root,2)[0]);
 const tensors=vec(sg,0).map(ref);
 const tensor = id => { const t=tensors[id]; return {id,name:str(field(t,3)),shape:vec(t,0).map(i),type:field(t,1)?b[field(t,1)]:0}; };
 console.log(JSON.stringify({path,inputs:vec(sg,1).map(i).map(tensor),outputs:vec(sg,2).map(i).map(tensor),metadata:vec(root,6).map(ref).map(t=>({name:str(field(t,0)),buffer:i(field(t,1))}))},null,2));
}
