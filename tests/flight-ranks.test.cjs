const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict')
const {test}=require('node:test'),{PNG}=require('pngjs')
const mod={exports:{}}
new Function('exports',ts.transpileModule(fs.readFileSync('src/flight-ranks.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports)
const {flightRankTier,FLIGHT_RANKS,RANK_PALETTES}=mod.exports
test('shared insignia progression preserves every hundred-second boundary and resets safely',()=>{
 assert.equal(FLIGHT_RANKS.length,11)
 for(let tier=1;tier<=10;tier++){
  assert.equal(flightRankTier(tier*100-.001),tier-1)
  assert.equal(flightRankTier(tier*100),tier)
  assert.equal(flightRankTier(`${tier*100}.25s`),tier)
 }
 for(const value of [0,-1,NaN,Infinity,'invalid',''])assert.equal(flightRankTier(value),0)
 assert.equal(flightRankTier(100000),10)
 assert.equal(flightRankTier(0),0,'landing/replay returns to Cadet')
})
test('each rank supplies unique small artwork and a matching transparent avatar plate',()=>{
 const unique=new Set()
 for(let tier=0;tier<=10;tier++){
  const base=`assets/ui/ranks/rank-${tier}`
  const icon=fs.readFileSync(base+'.png');unique.add(icon.toString('base64'))
  const png=PNG.sync.read(icon);assert.equal(png.width/png.height,2)
  const plate=PNG.sync.read(fs.readFileSync(base+'-plate.png'))
  const mask=PNG.sync.read(fs.readFileSync(base+'-plate-alpha.png'))
  assert.equal(plate.width,384);assert.equal(plate.height,224)
  assert.equal(mask.width,plate.width);assert.equal(mask.height,plate.height)
  for(const i of [0,383,384*223,384*224-1])assert.equal(plate.data[i*4+3],0,'corners remain transparent')
  for(let i=0;i<plate.width*plate.height;i++)assert.equal(mask.data[i*4],plate.data[i*4+3],'explicit alpha follows the plate artwork')
 }
 assert.equal(unique.size,11)
})

test('every rank splash uses its insignia metal palette and a transparent miniature sphere',()=>{
 const distinct=new Set()
 for(let tier=0;tier<FLIGHT_RANKS.length;tier++){
   const base=`assets/ui/ranks/rank-${tier}-orb`,svg=fs.readFileSync(base+'.svg','utf8')
   for(const color of RANK_PALETTES[tier])assert.ok(svg.includes(color))
   const bytes=fs.readFileSync(base+'.png'),png=PNG.sync.read(bytes);distinct.add(bytes.toString('base64'))
   assert.equal(png.width,64);assert.equal(png.height,64)
   assert.equal(png.data[3],0,'orb sprite has transparent corners')
   assert.equal(png.data[(32*64+32)*4+3],255,'sphere center is visible')
 }
 assert.equal(distinct.size,FLIGHT_RANKS.length)
 assert.ok(fs.statSync('assets/sounds/achievement-rank.mp3').size>0)
})
