const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    res.setHeader('Cache-Control','no-cache');
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
    let file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){
        if(path.extname(pathname)){res.writeHead(404).end();return}
        file=path.join(root,'index.html');
    }
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`PWA preview: http://127.0.0.1:${server.address().port}`));
