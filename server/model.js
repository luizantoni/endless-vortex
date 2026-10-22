const { flightRankTier } = require('../src/flight-ranks.ts')
function dayKey(now) { return new Date(now).toISOString().slice(0, 10) }
function weekKey(now) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return dayKey(date.getTime())
}
function emptyDb() { return { version: 1, players: [], weeks: [] } }
function validateResult(value, now) {
  if (!value || typeof value.userId !== 'string' || !value.userId.length || value.userId.length > 96 ||
      typeof value.name !== 'string' || value.name.length > 64 ||
      !Number.isSafeInteger(value.airtimeMs) || value.airtimeMs <= 0 ||
      !Number.isSafeInteger(value.finishedAt) || value.finishedAt > now + 5000 || value.finishedAt < now - 86400000 ||
      typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null
  const startDay = Date.parse(value.day + 'T00:00:00Z')
  if (!Number.isFinite(startDay) || dayKey(startDay) !== value.day || startDay > value.finishedAt ||
      value.airtimeMs > value.finishedAt - startDay) return null
  return { userId: value.userId, name: value.name.replace(/<[^>]*>/g, '').slice(0, 32),
    airtimeMs: value.airtimeMs, day: value.day, finishedAt: value.finishedAt }
}
function applyResult(db, result, now) {
  let player = db.players.find(item => item.userId === result.userId)
  if (!player) { player = { userId: result.userId, name: result.name, bestMs: 0 }; db.players.push(player) }
  player.name = result.name
  player.bestMs = Math.max(player.bestMs, result.airtimeMs)
  const week = weekKey(result.finishedAt)
  let table = db.weeks.find(item => item.week === week)
  if (!table) { table = { week, rows: [] }; db.weeks.push(table) }
  let row = table.rows.find(item => item.userId === result.userId)
  if (!row) { row = { userId: result.userId, name: result.name, airtimeMs: 0, day: result.day }; table.rows.push(row) }
  if (result.airtimeMs >= row.airtimeMs) { row.airtimeMs = result.airtimeMs; row.day = result.day; row.name = result.name }
  const previousWeek = weekKey(now - 7 * 86400000)
  db.weeks = db.weeks.filter(item => item.week >= previousWeek)
  return db
}
function standings(db, now) {
  const rows = [...(db.weeks.find(item => item.week === weekKey(now))?.rows || [])]
    .sort((a, b) => b.airtimeMs - a.airtimeMs || a.userId.localeCompare(b.userId))
  let rank = 0
  return rows.map((row, i) => { if (i === 0 || row.airtimeMs !== rows[i - 1].airtimeMs) rank = i + 1; return { ...row, rank } }).slice(0, 10)
}
function snapshot(db, userId, now) {
  const player = db.players.find(item => item.userId === userId)
  return { bestMs: player?.bestMs || 0, rankTier: flightRankTier((player?.bestMs || 0)/1000),
    week: weekKey(now), rows: standings(db, now), serverTime: now, verified: false }
}
module.exports = { dayKey, weekKey, emptyDb, validateResult, applyResult, standings, snapshot }
