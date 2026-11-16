const {defineConfig}=require('@playwright/test');
const fs=require('node:fs');
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
module.exports=defineConfig({
    testDir:'./tests/web',
    timeout:45000,
    workers:1,
    use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||(process.platform==='darwin'&&fs.existsSync(chrome)?chrome:undefined)}},
    webServer:{command:'node scripts/preview-web.cjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:20000},
});
