'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const EventEmitter = require('events');
const source = fs.readFileSync(__dirname + '/bot.js', 'utf8');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function boot(env = {}) {
  let handler, start;
  const intervals = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-06T13:00:00Z'])); } }
  const context = vm.createContext({
    process: { env }, Buffer, URL, Date: Clock,
    console: { log() {}, error() {} },
    setInterval(fn, ms) { intervals.push({fn, ms}); },
    require(name) {
      if (name === 'crypto') return crypto;
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen(port, fn) { start = fn; } }; } };
      if (name === 'https') return { request() { throw new Error('Network must never run during tests'); } };
      throw new Error('Unexpected module: ' + name);
    },
    sent: [],
  });
  vm.runInContext(source, context);
  vm.runInContext('postTweet = function(text, cb) { sent.push(text); if (cb) cb(null, {data:{id:"test"}}); };', context);
  return {context, handler, start, intervals};
}
function request(bot, text, authorization, chunks) {
  const req = new EventEmitter();
  req.url = '/tweet'; req.method = 'POST';
  req.headers = authorization ? {authorization} : {};
  const res = {code: null, body: null, ends: 0, writeHead(code) {this.code=code;}, end(body) {this.body=body;this.ends++;} };
  bot.handler(req, res);
  if (!res.ends) {
    for (const chunk of chunks || [JSON.stringify({text})]) req.emit('data', chunk);
    req.emit('end');
  }
  return res;
}
check('manual posting disabled without a configured token', () => {
  const bot=boot(); const r=request(bot,'hello','Bearer example');
  assert.strictEqual(r.code,503); assert.strictEqual(bot.context.sent.length,0);
});
check('missing bearer cannot post', () => {
  const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
  assert.strictEqual(request(bot,'hello').code,401); assert.strictEqual(bot.context.sent.length,0);
});
check('wrong bearer cannot post', () => {
  const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
  assert.strictEqual(request(bot,'hello','Bearer wrong-token').code,401); assert.strictEqual(bot.context.sent.length,0);
});
check('correct bearer posts exactly once', () => {
  const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
  const r=request(bot,'authorized example','Bearer offline-test');
  assert.strictEqual(r.code,200); assert.deepStrictEqual(Array.from(bot.context.sent),['authorized example']); assert.strictEqual(r.ends,1);
});
check('invalid JSON cannot post', () => {
  const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
  const r=request(bot,null,'Bearer offline-test',['{broken']);
  assert.strictEqual(r.code,400); assert.strictEqual(bot.context.sent.length,0);
});
check('blank, null and non-string text cannot post', () => {
  for (const text of ['   ',null,123]) {
    const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
    assert.strictEqual(request(bot,text,'Bearer offline-test').code,400);
    assert.strictEqual(bot.context.sent.length,0);
  }
});
check('oversized body returns one error and never posts', () => {
  const bot=boot({MANUAL_POST_TOKEN:'offline-test'});
  const r=request(bot,null,'Bearer offline-test',['x'.repeat(32769),'trailing']);
  assert.strictEqual(r.code,413); assert.strictEqual(r.ends,1); assert.strictEqual(bot.context.sent.length,0);
});
check('default startup does not start or invoke scheduled posting', () => {
  const bot=boot(); bot.start(); vm.runInContext('checkSchedule()',bot.context);
  assert.strictEqual(bot.intervals.length,0); assert.strictEqual(bot.context.sent.length,0);
});
check('explicit scheduled-post opt-in runs the scheduled message', () => {
  const bot=boot({ENABLE_SCHEDULED_POSTS:'true'}); bot.start();
  assert.strictEqual(bot.intervals.length,1); assert.strictEqual(bot.context.sent.length,1);
  assert.ok(bot.context.sent[0].includes('Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV'));
  vm.runInContext('checkSchedule()',bot.context);
  assert.strictEqual(bot.context.sent.length,1);
});
check('all post templates fit 280 raw Unicode characters and contain no superseded claims', () => {
  const bot=boot();
  assert.strictEqual(bot.context.SCHEDULE.length,4);
  for (const item of bot.context.SCHEDULE) {
    assert.ok([...item.text].length <= 280, item.id + ' is too long');
    assert.ok(!/2oQmHWo|moonshot|Raydium|\$73K|lending protocol|coinhunt|coinvote|jup\.ag/i.test(item.text));
  }
});
check('status reports the current mint and posting gates', () => {
  const bot=boot();
  let status;
  bot.handler({url:'/',method:'GET'}, {writeHead(code){assert.strictEqual(code,200);},end(body){status=JSON.parse(body);}});
  assert.strictEqual(status.ca,'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV');
  assert.strictEqual(status.trading_url,'https://tebfun.xyz/token/'+status.ca);
  assert.strictEqual(status.scheduled_posts_enabled,false);
  assert.strictEqual(status.manual_post_enabled,false);
});
console.log(checks + ' checks passed; no network calls or posts sent.');
