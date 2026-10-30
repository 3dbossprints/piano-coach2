const fs = require('fs');
const path = require('path');
function walk(dir, base='') {
  let out=[];
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const full=path.join(dir,e.name);
    const rel=path.join(base,e.name);
    if (e.isDirectory()) out=out.concat(walk(full,rel));
    else out.push({full,rel});
  }
  return out;
}
function crc32(buf){
  let c=0xffffffff;
  for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);}
  return (c^0xffffffff)>>>0;
}
const src=process.argv[2];
const dst=process.argv[3];
const entries=walk(src);
const localParts=[]; let offset=0;
for (const {full,rel} of entries) {
  const data=fs.readFileSync(full);
  const name=rel.split(path.sep).join('/');
  const crc=crc32(data);
  const lh=Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4); lh.writeUInt16LE(0,6); lh.writeUInt16LE(0,8);
  lh.writeUInt16LE(0,10); lh.writeUInt16LE(0,12);
  lh.writeUInt32LE(crc,14); lh.writeUInt32LE(data.length,18); lh.writeUInt32LE(data.length,22);
  lh.writeUInt16LE(name.length,26); lh.writeUInt16LE(0,28);
  const nameBuf=Buffer.from(name);
  const local=Buffer.concat([lh,nameBuf,data]);
  localParts.push({local,name,crc,size:data.length,offset});
  offset+=local.length;
}
const cdBufs=[];
for (const e of localParts) {
  const cd=Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50,0); cd.writeUInt16LE(20,4); cd.writeUInt16LE(20,6);
  cd.writeUInt16LE(0,8); cd.writeUInt16LE(0,10); cd.writeUInt16LE(0,12); cd.writeUInt16LE(0,14);
  cd.writeUInt32LE(e.crc,16); cd.writeUInt32LE(e.size,20); cd.writeUInt32LE(e.size,24);
  cd.writeUInt16LE(e.name.length,28); cd.writeUInt16LE(0,30); cd.writeUInt16LE(0,32);
  cd.writeUInt16LE(0,34); cd.writeUInt16LE(0,36); cd.writeUInt32LE(0,38); cd.writeUInt32LE(e.offset,42);
  cdBufs.push(Buffer.concat([cd,Buffer.from(e.name)]));
}
const cdData=Buffer.concat(cdBufs);
const eocd=Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50,0);
eocd.writeUInt16LE(0,4); eocd.writeUInt16LE(0,6);
eocd.writeUInt16LE(localParts.length,8); eocd.writeUInt16LE(localParts.length,10);
eocd.writeUInt32LE(cdData.length,12); eocd.writeUInt32LE(offset,16); eocd.writeUInt16LE(0,20);
const all=Buffer.concat([...localParts.map(e=>e.local),cdData,eocd]);
fs.writeFileSync(dst,all);
console.log('wrote',dst,entries.length,'files');
