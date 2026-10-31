// Co Center (the shared showcase in the "Kapsulep & Co" card): the public data its embedded
// script (web/public/kap/co-center-embed.js) picks windows from, see docs/CO-CENTER-SPEC.md.
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import type { RegionId } from '@shared/types'
import { nowIso, type AppContext } from '../context'
import { parseProfile } from './windows'

/** Every owned window open to visitors, with only public fields. */
export async function coCenterWindows(ctx: AppContext) {
  const rows = await ctx.db
    .selectFrom('windows')
    .select(['region', 'num', 'code', 'title', 'image_url', 'profile_json', 'content_updated_at', 'last_image_updated_at', 'claimed_at'])
    .where('owner_id', 'is not', null)
    .where('suspended_at', 'is', null)
    .execute()
  const windows = rows.map((r) => {
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
  })
  return { serverTime: nowIso(), windows }
}
