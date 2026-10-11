// Regenerates models.mjs — the models the provider offers before anyone has
// signed in — from amr-link's live catalog, which is the account's own list
// (it is what the plugin reads for a signed-in account too).
//
//   bun scripts/refresh-models.mjs            # key from magpie's sign-in
//   OPENDESIGN_KEY=sk-amr-… bun scripts/refresh-models.mjs
//
// The key is the account's runtime key: magpie keeps it in plugin-auth.json
// after `magpie plugin login opendesign`, and it is never printed or written
// anywhere but the Authorization header. A name already in models.mjs is
// kept — the catalog carries ids, not names.
//
// magpie runs a plugin host per command, so `magpie plugin login` has to have
// finished before this reads the key it saved.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// the file this writes: beside the script (a package of its own), else one
// level up (this repository's scripts/ with models.mjs at its root)
const HERE = dirname(fileURLToPath(import.meta.url))
const TARGET = [join(HERE, "models.mjs"), join(HERE, "..", "models.mjs")].find(existsSync)
const API = "https://amr-link.open-design.ai/v1"

if (!TARGET) {
  console.error("no models.mjs beside this script or one level up")
  process.exit(1)
}

const magpieKey = () => {
  const dir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  try {
    const auth = JSON.parse(readFileSync(join(dir, "magpie", "plugin-auth.json"), "utf8")).opendesign
    return auth?.access || auth?.key || ""
  } catch {
    return ""
  }
}

const key = (process.env.OPENDESIGN_KEY || "").trim() || magpieKey()
if (!key) {
  console.error("No key: sign in with `magpie plugin login opendesign`, or set OPENDESIGN_KEY=sk-amr-…")
  process.exit(1)
}

const res = await fetch(`${API}/models`, { headers: { authorization: `Bearer ${key}` } })
if (!res.ok) {
  console.error(`amr-link answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  process.exit(1)
}
const body = await res.json()
const catalog = (body?.data ?? []).filter((m) => typeof m?.id === "string" && m.id.trim())
if (!catalog.length) {
  console.error("amr-link listed no models")
  process.exit(1)
}

// names already chosen are kept: the catalog has ids only
let before = {}
try {
  ;({ MODELS: before } = await import(pathToFileURL(TARGET).href))
} catch {}

const input = (m) => {
  const said = Array.isArray(m?.architecture?.input_modalities) ? m.architecture.input_modalities : []
  return said.filter((x) => typeof x === "string" && x !== "text")
}
const lines = []
for (const m of catalog) {
  const id = m.id.trim()
  const meta = m.metadata ?? {}
  const facts = []
  const context = Number(meta.context_limit)
  const output = Number(meta.context_budget)
  if (Number.isFinite(context) && context > 0) facts.push(`context: ${context}`)
  if (Number.isFinite(output) && output > 0) facts.push(`output: ${output}`)
  const extra = input(m)
  if (extra.length) facts.push(`input: [${extra.map((x) => JSON.stringify(x)).join(", ")}]`)
  if (typeof meta.cost === "string") facts.push(`cost: ${JSON.stringify(meta.cost)}`)
  if (typeof meta.capability === "string") facts.push(`capability: ${JSON.stringify(meta.capability)}`)
  const name = before[id]?.name ?? id
  lines.push(`  ${JSON.stringify(id)}: { name: ${JSON.stringify(name)}${facts.length ? ", " + facts.join(", ") : ""} },`)
}

const header = `// The models an account is offered before anyone has signed in — the seed
// magpie and OpenCode read for the provider. Regenerate with
// \`bun scripts/refresh-models.mjs\` (see scripts/refresh-models.mjs): it
// reads amr-link's catalog at the signed-in account's key, which is the same
// list a signed-in account is given again on every listing.
//
// name: what the model is called; context/output: its token limits; input:
// the non-text modalities it takes; cost and capability: the vendor's own
// words, which the plugin turns into magpie's rate and thinking flags.

export const MODELS = {
${lines.join("\n")}
}
`
writeFileSync(TARGET, header)
console.log(`${TARGET}: ${lines.length} models`)
