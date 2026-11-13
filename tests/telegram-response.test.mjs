import assert from 'node:assert/strict';
import {telegramResult} from '../lib/telegram-response.ts';
assert.equal(telegramResult(200,{ok:true},1).status,'sent');
assert.deepEqual(telegramResult(429,{ok:false,error_code:429,parameters:{retry_after:20}},1,1000),{status:'retry_wait',retryAt:21000,errorCode:'429'});
assert.equal(telegramResult(429,{ok:false,error_code:429},3).status,'failed');
assert.equal(telegramResult(500,{},1).status,'uncertain');
assert.equal(telegramResult(401,{ok:false,error_code:401},1).status,'failed');
assert.equal(telegramResult(200,{},1).status,'failed');
console.log('Passed: confirmed sends, retry-after, retry cap and no automatic retry of uncertain sends.');
