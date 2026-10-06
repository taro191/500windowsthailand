// npm run migrate | npm run seed
import { config } from '../config'
import { createSecrets } from '../lib/crypto'
import { createDb } from './index'
import { migrate } from './migrations'
import { seed } from './seed'

const command = process.argv[2]
const ctx = { db: createDb(config.db), config, secrets: createSecrets(config.appSecret) }

try {
  await migrate(ctx.db)
  if (command === 'seed') await seed(ctx)
} finally {
  await ctx.db.destroy()
}
