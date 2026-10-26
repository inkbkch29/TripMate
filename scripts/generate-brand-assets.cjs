// Canonical artwork: public/brand/tripmate-mark.svg. Generated files are committed.
// Run with Node and sharp available, or set SHARP_MODULE to its installed module path.
const sharp=require(process.env.SHARP_MODULE || 'sharp');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const target=path.resolve(__dirname,'../public');
 const mark=await fs.readFile(path.join(target,'brand/tripmate-mark.svg'),'utf8');
 const icon=mark.replace('<defs>','<rect width="1024" height="1024" fill="#FFFFFF"/><defs>');
 await fs.writeFile(path.join(target,'app-icon.svg'),icon);
 for(const [name,size] of [['app-icon-1024.png',1024],['app-icon-512.png',512],['app-icon-192.png',192],['apple-touch-icon.png',180],['app-icon-64.png',64],['favicon-32.png',32]]){
  await sharp(Buffer.from(icon)).resize(size,size).png().toFile(path.join(target,name));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
