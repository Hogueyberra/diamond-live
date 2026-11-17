import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { answerRequest } from '../server/assistant.mjs';
const corpus = JSON.parse(readFileSync(new URL('../server/data/rules.json', import.meta.url)));
const model = process.argv[2] || 'qwen2.5:14b';
const tests = [
 {question:'Can a Minor B pitcher pitch a fourth inning after only 25 pitches?', division:'Minor B', expected:'hvll-2026-section-x-k', method:'verified-rule'},
 {question:'When can we use a courtesy runner for the catcher?', division:'Minor B', expected:'hvll-2026-section-x-i'},
 {question:'Can we start a game with eight players?', division:'Minor B', expected:'hvll-2026-section-x-c'},
 {question:'Can a child sit out a second inning before everyone else sits once?', division:'Minor B', expected:'hvll-2026-section-x-a'},
 {question:'Can a pitcher removed earlier return to pitch in the same game?', division:'Minor B', expected:'hvll-2026-section-x-f', method:'verified-rule'},
 {question:'Can my eight-year-old pitch today after 42 pitches yesterday?', division:'Minor B', method:'source-passages'},
 {question:'Is intentional bunting allowed?', division:'Minor C', expected:'hvll-2026-section-xi-h'},
 {question:'Can runners steal bases?', division:'Rookie Ball', expected:'hvll-2026-section-xiii-h'},
];
const results=[];
for(const t of tests){const r=await answerRequest({mode:'rules',year:'2026',...t},{corpus,model}); const passed=(!t.expected||r.sources.some(s=>s.id===t.expected))&&(!t.method||r.method===t.method);results.push({test:t,...r,passed});console.log(t.question,r.method,r.elapsedMs+'ms',passed?'PASS':'REVIEW');}
const p=await answerRequest({mode:'practice',practice:{age:8,players:8,coaches:2,teamMinutes:15,homeMinutes:10,summary:[{skillId:'if_glove',observed:8,needsPractice:6},{skillId:'if_footwork',observed:8,needsPractice:5}]}},{corpus,model});
results.push({test:'practice',...p,passed:p.plan.team.blocks.reduce((a,b)=>a+b.minutes,0)===15&&p.plan.home.blocks.reduce((a,b)=>a+b.minutes,0)===10});
console.log('practice',p.elapsedMs+'ms');
const g=await answerRequest({mode:'general',question:'How can I encourage a child who is frustrated after missing a ground ball?'},{corpus,model});results.push({test:'general',...g}); console.log('general',g.elapsedMs+'ms');
mkdirSync(new URL('../output/ai-evaluation/',import.meta.url),{recursive:true});writeFileSync(new URL(`../output/ai-evaluation/integrated-${model.replace(':','-')}.json`,import.meta.url),JSON.stringify(results,null,2)+'\n');
