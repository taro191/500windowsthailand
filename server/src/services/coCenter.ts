// Co Center (the shared showcase in the "500 Windows Thailand : Store" card): the public data its embedded
// script (web/public/kap/co-center-embed.js) picks windows from, see docs/CO-CENTER-SPEC.md.
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import type { RegionId } from '@shared/types'
import type { WindowRow } from '../db/schema'
import { nowIso, type AppContext } from '../context'
import { parseProfile } from './windows'

const CARD_COLUMNS = ['region', 'num', 'code', 'title', 'image_url', 'profile_json', 'content_updated_at', 'last_image_updated_at', 'claimed_at'] as const
type CardRow = Pick<WindowRow, (typeof CARD_COLUMNS)[number]>

/** A window card as the Co Center and central page scripts read it (public fields only). */
function toCard(r: CardRow) {
  const region = r.region as RegionId
  const profile = parseProfile(r.profile_json)
  return {
    id: r.code,
    group: region,
    groupName: REGIONS_BY_ID[region]?.name ?? region,
    gOrder: REGION_IDS.indexOf(region),
    rank: r.num,
    name: r.title,
    tag: profile.tags.join(', '),
    logo: profile.logoUrl,
    cover: r.image_url,
    url: `/w/${region}/${r.num}`,
    updatedAt: r.content_updated_at || r.last_image_updated_at || r.claimed_at || '',
  }
}

/** Public cards of these windows in the given order; ones not open to visitors are left out. */
export async function windowCards(ctx: AppContext, region: RegionId, nums: number[]) {
  const rows = await ctx.db
    .selectFrom('windows')
    .select(CARD_COLUMNS)
    .where('region', '=', region)
    .where('num', 'in', nums)
    .where('owner_id', 'is not', null)
    .where('suspended_at', 'is', null)
    .where('published_at', 'is not', null)
    .where('image_url', '!=', '')
    .execute()
  return nums.flatMap((n) => rows.filter((r) => r.num === n).map(toCard))
}

/** Every owned window open to visitors and showing content, with only public fields. */
export async function coCenterWindows(ctx: AppContext) {
  const rows = await ctx.db
    .selectFrom('windows')
    .select(CARD_COLUMNS)
    .where('owner_id', 'is not', null)
    .where('suspended_at', 'is', null)
    .where('published_at', 'is not', null)
    // Taken-down windows (no main image, title replaced by a notice) are not featured.
    .where('image_url', '!=', '')
    .execute()
  return { serverTime: nowIso(), windows: rows.map(toCard) }
}
