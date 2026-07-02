import "dotenv/config"
import { startOutboxRelay } from "./services/outboxRelay"

startOutboxRelay().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[outbox-relay] startup failed: ${message}`)
  process.exit(1)
})
