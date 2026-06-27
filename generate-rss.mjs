/**
 * generate-rss.mjs
 * Bluesky「創作百合」フィード → RSS 2.0 XML 生成スクリプト
 *
 * 環境変数:
 *   BSKY_IDENTIFIER  : Blueskyのhandle (例: yourname.bsky.social)
 *   BSKY_APP_PASSWORD: Blueskyのapp password
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FEED_AT_URI =
  'at://did:plc:hvh4jnvd2j5fgczxabdme4nu/app.bsky.feed.generator/aaaddbrcslzj4'
const FEED_NAME = '創作百合'
const FEED_URL = 'https://bsky.app/profile/citrus-rin.jp/feed/aaaddbrcslzj4'
const BSKY_API = 'https://bsky.social/xrpc'
const LIMIT = 50
const OUTPUT_PATH = join(__dirname, 'rss', 'sosaku-yuri.xml')

// --- 認証 ---
async function createSession(identifier, password) {
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!res.ok) throw new Error(`認証失敗: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.accessJwt
}

// --- フィード取得 ---
async function getFeed(token) {
  const url = new URL(`${BSKY_API}/app.bsky.feed.getFeed`)
  url.searchParams.set('feed', FEED_AT_URI)
  url.searchParams.set('limit', String(LIMIT))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`フィード取得失敗: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.feed // FeedViewPost[]
}

// --- RSS XML 生成 ---
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildRss(feedItems) {
  const items = feedItems
    .map((item) => {
      const post = item.post
      const author = post.author
      const record = post.record
      const text = record?.text ?? ''
      const cid = post.cid
      const did = author.did
      const rkey = post.uri.split('/').pop()
      const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`
      const pubDate = new Date(record?.createdAt ?? Date.now()).toUTCString()
      const displayName = author.displayName || author.handle
      const title = text.slice(0, 60).replace(/\n/g, ' ') + (text.length > 60 ? '…' : '')

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(displayName)} (@${escapeXml(author.handle)})</author>
      <description><![CDATA[${text.replace(/\n/g, '<br>')}]]></description>
    </item>`
    })
    .join('\n')

  const now = new Date().toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${FEED_NAME} - Bluesky Feed</title>
    <link>${FEED_URL}</link>
    <description>#創作百合 または #百合漫画 タグをつけた日本語ポストのフィード</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>`
}

// --- メイン ---
async function main() {
  const identifier = process.env.BSKY_IDENTIFIER
  const password = process.env.BSKY_APP_PASSWORD

  if (!identifier || !password) {
    console.error('環境変数 BSKY_IDENTIFIER と BSKY_APP_PASSWORD を設定してください')
    process.exit(1)
  }

  console.log('🔑 Bluesky認証中...')
  const token = await createSession(identifier, password)

  console.log('📡 フィード取得中...')
  const feedItems = await getFeed(token)
  console.log(`✅ ${feedItems.length}件取得`)

  const xml = buildRss(feedItems)

  mkdirSync(join(__dirname, 'rss'), { recursive: true })
  writeFileSync(OUTPUT_PATH, xml, 'utf-8')
  console.log(`📄 RSS生成完了: ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
