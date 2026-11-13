import assert from 'node:assert/strict';
import {analyse,indicators} from '../lib/desk.ts';
import {aggregateCandles,validTimeframe} from '../lib/timeframes.ts';
const now=Date.now(),end=Math.floor(now/900000)*900;
const c=Array.from({length:100},(_,i)=>({time:end-(100-i)*900,open:100,high:101,low:99,close:100}));
assert.equal(analyse(c,'Forex','TEST',15,now),null);
assert.equal(indicators(c).adx,0);assert.equal(indicators(c).rsi,50);
const spike={time:end,open:100,high:1000,low:99,close:900};
assert.deepEqual(analyse([...c,spike],'Forex','TEST',15,now),analyse(c,'Forex','TEST',15,now));
assert.equal(analyse(c.map(b=>({...b,time:b.time-86400})),'Forex','TEST',15,now),null);
assert.equal(analyse([...c.slice(0,-1),{...c.at(-1),high:95}],'Forex','TEST',15,now),null);
assert.throws(()=>validTimeframe(7));for(const n of [1,5,15,30,60,240,1440])assert.equal(validTimeframe(n),n);
assert.deepEqual(aggregateCandles([{time:0,open:1,high:3,low:1,close:2},{time:900,open:2,high:4,low:.5,close:3}],1800),[{time:0,open:1,high:4,low:.5,close:3}]);
// Timeframe identity and completed-candle boundaries must stay isolated.
assert.equal(analyse(c,'Forex','TEST',60,now),null);
console.log('Passed: incomplete candles ignored, stale/invalid data rejected, flat markets filtered, timeframe validation and OHLC aggregation.');

const trend=Array.from({length:100},(_,i)=>{const close=100+i*.02+Math.sin(i*.7)*.2;return {time:end-(100-i)*900,open:close-.03,high:close+.05,low:close-.1,close}});
const prior=Math.max(...trend.slice(-21,-1).map(b=>b.high));trend[99]={...trend[99],open:prior-.1,high:prior+.15,low:prior-.15,close:prior+.1};
const buy=analyse(trend,'Forex','TEST',15,now);assert.equal(buy?.side,'BUY');assert.ok(buy.stop<buy.entry&&buy.target>buy.entry);
assert.deepEqual(analyse([...trend,spike],'Forex','TEST',15,now),buy);
const mirrored=trend.map(b=>({...b,open:220-b.open,high:220-b.low,low:220-b.high,close:220-b.close}));assert.equal(analyse(mirrored,'Forex','TEST',15,now)?.side,'SELL');
const hourly=trend.map((b,i)=>({...b,time:Math.floor(now/3600000)*3600-(100-i)*3600}));const hourSignal=analyse(hourly,'Forex','TEST',60,now);assert.equal(hourSignal?.side,'BUY');assert.notEqual(hourSignal.id,buy.id);
console.log('Passed: buy/sell fixtures, stop/target direction, no look-ahead, timeframe-specific identity.');
