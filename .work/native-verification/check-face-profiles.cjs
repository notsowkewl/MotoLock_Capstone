// Read-only metadata audit. Never print keys, identities, or biometric vectors.
const fs=require('fs');
const source=fs.readFileSync('C:/Users/Ari/Documents/MotoLock_Native/app/src/main/java/com/example/motolock/network/SupabaseClientManager.kt','utf8');
const url=source.match(/supabaseUrl\s*=\s*"([^"]+)"/)[1];
const key=source.match(/supabaseKey\s*=\s*"([^"]+)"/)[1];
(async()=>{
 const response=await fetch(url+'/rest/v1/users?select=face_descriptor&limit=1000',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
 if(!response.ok) throw Error('Read-only database request returned HTTP '+response.status);
 const rows=await response.json(); const counts={visibleRows:rows.length,missing:0,valid192:0,constantPlaceholder:0,incompatibleLength:0,malformed:0};
 for(const row of rows) {
  let v=row.face_descriptor;
  if(v===null || v===undefined){counts.missing++;continue;}
  try {if(typeof v==='string')v=JSON.parse(v);if(!Array.isArray(v)||!v.every(x=>typeof x==='number'&&Number.isFinite(x)))throw Error();
   if(Math.max(...v)-Math.min(...v)<0.00001){counts.constantPlaceholder++;continue;}
   if(v.length===192)counts.valid192++;else counts.incompatibleLength++;
  }catch{counts.malformed++;}
 }
 console.log(JSON.stringify(counts));
 if(!rows.length) console.log('No rows visible to the app public key. This does not establish that no profiles exist.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
