import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasValidOrigin} from '../app/lib/request-origin.ts';
const req=(origin,host='localhost:3003')=>({url:'http://0.0.0.0:3003/api/auth/login',headers:new Headers({...origin?{origin}:{},host})});
test('accepts browser host despite internal wildcard bind URL',()=>{
 for(const host of ['localhost:3003','127.0.0.1:3003','192.168.1.20:3003'])assert.equal(hasValidOrigin(req('http://'+host,host)),true);
});
test('rejects cross-origin, missing, null and malformed origins',()=>{
 for(const origin of ['http://evil.example','http://localhost:3004',undefined,'null','http://localhost:3003/path'])assert.equal(hasValidOrigin(req(origin)),false);
});
test('explicit deployment origin supports HTTPS reverse proxy and rejects other hosts',()=>{
 assert.equal(hasValidOrigin(req('https://rider.example.com'),'https://rider.example.com'),true);
 assert.equal(hasValidOrigin(req('http://localhost:3003'),'https://rider.example.com'),false);
});
