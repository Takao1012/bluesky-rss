/**
 * generate-rss.mjs
 * Bluesky フィード → RSS 2.0 XML 生成スクリプト
 *
 * 環境変数:
 *   BSKY_IDENTIFIER  : Blueskyのhandle (例: yourname.bsky.social)
 *   BSKY_APP_PASSWORD: Blueskyのapp password
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BSKY_API = 'https://bsky.social/xrpc'
const LIMIT = 50

// 生成するフィードの定義
const FEEDS = [
  {
    type: 'feed',
    atUri: 'at://did:plc:hvh4jnvd2j5fgczxabdme4nu/app.bsky.feed.generator/aaaddbrcslzj4',
    name: '創作百合',
    description: '#創作百合 または #百合漫画 タグをつけた日本語ポストのフィード',
    url: 'https://bsky.app/profile/citrus-rin.jp/feed/aaaddbrcslzj4',
    outputFile: 'rss/sosaku-yuri.xml',
  },
  {
    type: 'feed',
    atUri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
    name: 'Discover',
    description: 'Trending content from your personal network',
    url: 'https://bsky.app/profile/bsky.app/feed/whats-hot',
    outputFile: 'rss/discover.xml',
  },
  {
    type: 'list',
    atUri: 'at://did:plc:auhve2r7l3yqh3zpnkmmmorc/app.bsky.graph.list/3mpnicpopcy25',
    name: '百合マンガ作家リスト',
    description: '追いかけている百合マンガ作家さんたちの投稿をまとめて確認するためのリストです',
    url: 'https://bsky.app/profile/txkxoxn.bsky.social/lists/3mpnicpopcy25',
    outputFile: 'rss/yuri-mangaka.xml',
  },
]

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

// --- フィード取得(Feed Generator用) ---
async function getFeed(token, atUri) {
  const url = new URL(`${BSKY_API}/app.bsky.feed.getFeed`)
  url.searchParams.set('feed', atUri)
  url.searchParams.set('limit', String(LIMIT))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`フィード取得失敗: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.feed // FeedViewPost[]
}

// --- フィード取得(List用) ---
async function getListFeed(token, atUri) {
  const url = new URL(`${BSKY_API}/app.bsky.feed.getListFeed`)
  url.searchParams.set('list', atUri)
  url.searchParams.set('limit', String(LIMIT))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`リストフィード取得失敗: ${res.status} ${await res.text()}`)
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

// --- 画像URL抽出 ---
function extractImages(post) {
  const embed = post.embed
  if (!embed) return []

  const images = []

  // app.bsky.embed.images#view
  if (embed.$type === 'app.bsky.embed.images#view' && Array.isArray(embed.images)) {
    for (const img of embed.images) {
      if (img.fullsize) images.push({ url: img.fullsize, alt: img.alt ?? '' })
      else if (img.thumb) images.push({ url: img.thumb, alt: img.alt ?? '' })
    }
  }

  // app.bsky.embed.recordWithMedia#view (引用ポスト+画像)
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media) {
    const media = embed.media
    if (media.$type === 'app.bsky.embed.images#view' && Array.isArray(media.images)) {
      for (const img of media.images) {
        if (img.fullsize) images.push({ url: img.fullsize, alt: img.alt ?? '' })
        else if (img.thumb) images.push({ url: img.thumb, alt: img.alt ?? '' })
      }
    }
  }

  return images
}

function buildRss(feedDef, feedItems) {
  const items = feedItems
    .map((item) => {
      const post = item.post
      const author = post.author
      const record = post.record
      const text = record?.text ?? ''
      const did = author.did
      const rkey = post.uri.split('/').pop()
      const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`
      const pubDate = new Date(record?.createdAt ?? Date.now()).toUTCString()
      const displayName = author.displayName || author.handle
      const title = text.slice(0, 60).replace(/\n/g, ' ') + (text.length > 60 ? '…' : '')

      // 画像をdescriptionに埋め込む
      const images = extractImages(post)
      const imgHtml = images
        .map((img) => `<img src="${img.url}" alt="${img.alt}" style="max-width:100%;margin-top:8px;">`)
        .join('\n')
      const descHtml = `${text.replace(/\n/g, '<br>')}${imgHtml ? '\n' + imgHtml : ''}`

      // 最初の画像をenclosureとして追加
      const enclosure = images.length > 0
        ? `\n      <enclosure url="${escapeXml(images[0].url)}" type="image/jpeg" length="0"/>`
        : ''

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(displayName)} (@${escapeXml(author.handle)})</author>
      <description><![CDATA[${descHtml}]]></description>
      <content:encoded><![CDATA[${descHtml}]]></content:encoded>${enclosure}
    </item>`
    })
    .join('\n')

  const now = new Date().toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${feedDef.name} - Bluesky Feed</title>
    <link>${feedDef.url}</link>
    <description>${escapeXml(feedDef.description)}</description>
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

  mkdirSync(join(__dirname, 'rss'), { recursive: true })

  for (const feed of FEEDS) {
    console.log(`📡 フィード取得中: ${feed.name}`)
    const feedItems = feed.type === 'list'
      ? await getListFeed(token, feed.atUri)
      : await getFeed(token, feed.atUri)
    console.log(`✅ ${feedItems.length}件取得`)

    const xml = buildRss(feed, feedItems)
    const outputPath = join(__dirname, feed.outputFile)
    writeFileSync(outputPath, xml, 'utf-8')
    console.log(`📄 RSS生成完了: ${outputPath}`)
  }
}

main().catch((err) => {
  console.error('❌ エラー:', err)
  process.exit(1)
})
