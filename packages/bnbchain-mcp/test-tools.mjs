import { spawn } from 'child_process';
const p = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
let out = '';
p.stdout.on('data', d => { out += d.toString(); });
p.stderr.on('data', d => {});
const msgs = [
  JSON.stringify({jsonrpc:'2.0',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1.0'}},id:1}),
  JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized',params:{}}),
  JSON.stringify({jsonrpc:'2.0',method:'tools/list',params:{},id:2})
];
p.stdin.write(msgs.join('\n') + '\n');
setTimeout(() => {
  p.stdin.end();
  setTimeout(() => {
    const lines = out.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        if (j.id === 2 && j.result && j.result.tools) {
          console.log('Total tools:', j.result.tools.length);
          j.result.tools.slice(0,5).forEach(t => console.log(' ', t.name));
          console.log('  ...');
        }
      } catch(e) {}
    }
    p.kill();
    process.exit(0);
  }, 2000);
}, 3000);
