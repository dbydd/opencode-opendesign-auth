# opencode-opendesign-auth

Open Design (open-design.ai) Cloud as a magpie / OpenCode provider: sign in
with the Open Design account, use the models its **Design Plan** entitles the
account to, and watch the plan's **5-hour and 7-day allowance** and wallet
balance where every other subscription's usage shows.

Works in [magpie](https://usemagpie.ai) (which runs OpenCode provider plugins)
and in OpenCode.

## What it signs in to

Open Design's cloud is two planes:

| Plane | Host | Key | Used for |
| --- | --- | --- | --- |
| Control | `amr-api.open-design.ai` | `vela_ctrl_…` | plan, wallet balance, the Design Plan's allowance windows, the workspace |
| Model | `amr-link.open-design.ai/v1` | `sk-amr-…` | `/models`, `/responses` (the OpenAI Responses API) |

A sign-in is the same device authorization the Open Design CLI
(`vela login`) runs:

1. the plugin POSTs `/api/v1/cli/device-authorizations` and gets a code
   (`4HYFNA`) and an activation page (`open-design.ai/cloud/cli/activate?…`);
2. magpie opens that page; approving it says the CLI is signing in;
3. the plugin polls it and receives both keys for that account, with the
   account's email and id.

Nothing else is needed, and nothing of the desktop app's own sign-in
(`~/.amr/config.json`, a different machine-issued pair of keys) is read or
written.

## Sign-in methods

| Method | What it stores | Allowance |
| --- | --- | --- |
| **Open Design account** | the account's control + runtime keys | 5-hour and 7-day windows, wallet balance, plan |
| **Open Design API key** | a pasted `sk-amr-…` key | not readable: `amr-api` doesn't take API keys |

The account sign-in is the one that shows the allowance; the API key one
is there for a machine that can't open the approval page.

## Models

Nothing is embedded: the list is `amr-link`'s live `/v1/models` for the
account, read on every listing, so it follows the plan — a personal **Go**
plan gets the eleven models its catalog enables today, and a different plan
or a vendor change is picked up without a plugin update. Limits, input
modalities and the vendor's own cost words (`rate`, e.g. `x0.5` for "low")
come from that same catalog; a model whose vendor tier is `advanced` is
marked as one that reasons.

Requests go to the **Responses** API (`@ai-sdk/openai` at
`https://amr-link.open-design.ai/v1`), which is what an Open Design API key
page recommends for Codex-style clients and what keeps thinking intact.

## Where the sign-in is kept

magpie's `plugin-auth.json` (mode 600), as an oauth account:
`{ type: "oauth", access: <runtime key>, control: <control key>, accountId:
<email>, uid: <account id> }`. Neither key expires, so there is nothing to
renew and `refresh` is empty.

## Use

In magpie:

```
magpie plugin add /path/to/opencode-opendesign-auth
magpie plugin login opendesign        # approve the page that opens
magpie plugin                         # opendesign (Open Design, 11 models) signed in
magpie provider test opendesign
magpie quota                          # opendesign · Design Plan Go · 5h 32% ↻3h
```

In OpenCode, `opencode.json`:

```json
{ "plugin": ["opencode-opendesign-auth"] }
```

then `opencode auth login`.

### Replacing a custom provider

The plugin signs in to the provider id `opendesign`. A **custom provider**
of that same id (Providers → the host and key by hand) takes the id first,
so the plugin's provider is then listed as `opendesign-plugin`, with no
models of its own. Delete the custom provider — `magpie provider rm
opendesign` — and the plugin's provider takes the plain id, so agent
configs pointing at `opendesign/<model>` keep working, now with the
allowance card.
