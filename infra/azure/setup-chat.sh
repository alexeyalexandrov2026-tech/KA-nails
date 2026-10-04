#!/usr/bin/env bash
# One-time setup of the KA Nails AI receptionist in Azure.
# Run it in Azure Cloud Shell (shell.azure.com):
#
#   git clone https://github.com/alexeyalexandrov2026-tech/KA-nails.git
#   bash KA-nails/infra/azure/setup-chat.sh
#
# It asks every question first and checks each key with its service, then
# creates everything from chat.bicep, stores the keys in Key Vault (typed
# here, never saved in files or chat) and prints the values to add in GitHub.
# Re-running it is safe: answers default to the last run, and Enter keeps a
# key that is already saved.
#
# The model runs on OpenRouter by default. MODEL_PROVIDER=foundry uses Claude
# Haiku 4.5 in Microsoft Foundry instead, which needs Claude quota on the
# subscription (pay-as-you-go subscriptions may still start at 0).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
group="${RESOURCE_GROUP:-rg-kanails-chat}"
location="${LOCATION:-eastus2}"
provider="${MODEL_PROVIDER:-openrouter}"
default_model="nvidia/nemotron-3-ultra-550b-a55b"
default_origins="https://ka-nails.pages.dev"

# --- Questions ----------------------------------------------------------------

# Drops keys pressed while the script was busy (an Enter during a wait), so
# they cannot answer the next question.
flush_input() {
  [ -t 0 ] || return 0
  python3 -c 'import sys, termios; termios.tcflush(sys.stdin, termios.TCIFLUSH)' 2>/dev/null || true
}

# Pasted text can carry bracketed-paste markers and other control characters.
strip_paste() { printf '%s' "$1" | sed $'s/\e\\[20[01]~//g' | tr -d '[:cntrl:]'; }

# ask PROMPT DEFAULT: the answer in $answer, DEFAULT on Enter.
ask() {
  local typed
  flush_input
  if [ -n "$2" ]; then read -rp "$1 [$2]: " typed; else read -rp "$1: " typed; fi
  answer="$(strip_paste "${typed:-$2}")"
}

# ask_secret PROMPT: a hidden answer in $answer, without any spaces.
ask_secret() {
  local typed
  flush_input
  read -rsp "$1" typed
  echo
  answer="$(strip_paste "$typed" | tr -d '[:space:]')"
}

# The last run's parameters and outputs, so a re-run only asks what changes.
last="$(az deployment group show -g "$group" -n kanails-chat --query properties -o json 2>/dev/null || true)"
# last_value parameters.emailTo | outputs.keyVaultName: the value, or "".
last_value() {
  [ -n "$last" ] || return 0
  printf '%s' "$last" | python3 -c '
import json, sys
node = json.load(sys.stdin)
for key in sys.argv[1].split("."):
    node = (node if isinstance(node, dict) else {}).get(key) or {}
print(node.get("value", "") if isinstance(node, dict) else "")' "$1"
}

vault="$(last_value outputs.keyVaultName)"
# key_state NAME: "saved", "missing", or "unknown" when Key Vault cannot be
# read (no access yet). Enter never writes a key, so "unknown" stays as it is.
key_state() {
  local out
  if [ -z "$vault" ]; then
    echo missing
  elif out="$(az keyvault secret show --vault-name "$vault" -n "$1" --query value -o tsv --only-show-errors 2>&1)"; then
    if [ -n "$out" ] && [ "$out" != none ]; then echo saved; else echo missing; fi
  elif [[ "$out" == *SecretNotFound* ]]; then
    echo missing
  else
    echo unknown
  fi
}

echo "KA Nails AI receptionist setup"
echo "Subscription: $(az account show --query name -o tsv)"
echo "All questions come first; after them there is nothing to type until the end."
echo

while :; do
  ask "Studio email that receives requests" "$(last_value parameters.emailTo)"
  [[ "$answer" == ?*@?*.?* ]] && break
  echo "Please type an email address."
done
email_to="$answer"

org_name=""
country="US"
model="$default_model"
if [ "$provider" = "foundry" ]; then
  ask "Legal name of the business using Claude (for the Anthropic terms)" "$(last_value parameters.claudeOrganizationName)"
  org_name="$answer"
  last_country="$(last_value parameters.claudeCountryCode)"
  ask "Country code of the business" "${last_country:-US}"
  country="$answer"
else
  last_model="$(last_value parameters.openRouterModel)"
  ask "OpenRouter model id (must support tool calling)" "${last_model:-$default_model}"
  model="$answer"
fi

# The API answers only these websites; add the studio domain (and its www
# form) here, and as SITE_URL in GitHub, once it has one.
last_origins="$(last_value parameters.allowedOrigins)"
ask "Website address(es) allowed to use the chat, comma-separated" "${last_origins:-$default_origins}"
origins="$answer"

# Enter never writes: an empty answer leaves Key Vault as it is.
openrouter_key=""
refused=""
if [ "$provider" != "foundry" ]; then
  echo
  echo "OpenRouter key: openrouter.ai -> Settings -> Keys. It starts with sk-or-."
  state="$(key_state openrouter-api-key)"
  while :; do
    case "$state" in
      saved) ask_secret "OpenRouter API key (hidden; Enter keeps the saved key): " ;;
      unknown) ask_secret "OpenRouter API key (hidden; Enter keeps whatever Key Vault has): " ;;
      *) ask_secret "OpenRouter API key (hidden while typing): " ;;
    esac
    if [ -z "$answer" ]; then
      if [ "$state" = missing ]; then
        echo "The chat cannot answer without this key. Paste it, or press Ctrl+C to stop."
        continue
      fi
      echo "Keeping the saved OpenRouter key."
      break
    fi
    if [[ "$answer" != sk-or-* ]]; then
      echo "That is not an OpenRouter key (it starts with sk-or-). Copy it again."
      continue
    fi
    status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
      -H "Authorization: Bearer $answer" https://openrouter.ai/api/v1/key || true)"
    if { [ "$status" = 401 ] || [ "$status" = 403 ]; } && [ "$answer" != "$refused" ]; then
      echo "OpenRouter refused this key. Copy it again or create a new one (the same key twice saves it anyway)."
      refused="$answer"
      continue
    fi
    openrouter_key="$answer"
    if [ "$answer" = "$refused" ]; then
      echo "Saving the key OpenRouter refused, as it was entered twice."
    elif [ "$status" = 200 ]; then
      echo "OpenRouter accepted the key."
    else
      echo "Could not check the key with OpenRouter (HTTP $status); it will be saved anyway."
    fi
    break
  done
fi

# tg TOKEN METHOD: a Telegram Bot API call ("" when it fails).
tg() { curl -sS --max-time 20 "https://api.telegram.org/bot$1/$2" 2>/dev/null || true; }

echo
echo "Telegram: the bot from @BotFather. In BotFather's message, tap the token to copy only it."
tg_token=""
chat_id=""
token_state="$(key_state telegram-bot-token)"
chat_state="$(key_state telegram-chat-id)"
if [ "$token_state" = saved ] && [ "$chat_state" = saved ]; then
  tg_hint="Enter keeps the saved bot, off switches Telegram off"
elif [ "$token_state" = unknown ] || [ "$chat_state" = unknown ]; then
  tg_hint="Enter keeps whatever Key Vault has, off switches Telegram off"
else
  tg_hint="Enter skips Telegram, requests go by email only"
fi
while :; do
  ask_secret "Telegram bot token (hidden; $tg_hint): "
  if [ -z "$answer" ]; then
    echo "Leaving Telegram as it is."
    break
  fi
  if [ "$answer" = off ]; then
    tg_token="none"
    chat_id="none"
    echo "Telegram will be switched off; requests go by email only."
    break
  fi
  if ! [[ "$answer" =~ ^[0-9]{5,}:[A-Za-z0-9_-]{30,}$ ]]; then
    echo "That is not a bot token (digits, a colon, then letters, like 1234567890:AAH...). Copy only the token."
    continue
  fi
  bot="$(tg "$answer" getMe | python3 -c '
import json, sys
try:
    reply = json.load(sys.stdin)
except ValueError:
    reply = {}
print(reply.get("result", {}).get("username", "") if reply.get("ok") else "")')"
  if [ -z "$bot" ]; then
    echo "Telegram does not accept this token. Copy it again from @BotFather."
    continue
  fi
  echo "Bot: @$bot"
  tg_token="$answer"
  break
done

# Requests go to the chat that sent /start most recently. Anyone who finds
# the bot can press Start, so the person running this confirms the chat.
if [ -n "$tg_token" ] && [ "$tg_token" != none ]; then
  while :; do
    found="$(tg "$tg_token" getUpdates | python3 -c '
import json, sys
try:
    updates = json.load(sys.stdin).get("result", [])
except ValueError:
    updates = []
for update in reversed(updates):
    message = update.get("message") or {}
    if (message.get("text") or "").startswith("/start"):
        chat = message["chat"]
        name = " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")]))
        print(chat["id"], chat.get("type", "?"), name or chat.get("title") or "?")
        break')"
    if [ -n "$found" ]; then
      read -r found_id found_type found_name <<<"$found"
      ask "Send requests to the Telegram $found_type chat of $found_name? y/n" "y"
      if [[ "$answer" != [Nn]* ]]; then
        chat_id="$found_id"
        echo "Requests will go to $found_name (chat id $chat_id)."
        break
      fi
      prompt="From the Telegram that should get requests, open @$bot and send /start, then press Enter here (or type a chat id)"
    else
      prompt="Nobody has sent /start to @$bot yet. From the Telegram that should get requests, open @$bot and press Start, then press Enter here (or type a chat id)"
    fi
    ask "$prompt" ""
    if [[ "$answer" =~ ^-?[0-9]+$ ]]; then
      chat_id="$answer"
      break
    fi
  done
fi

echo
echo "Cloudflare Turnstile (required): Cloudflare -> Turnstile -> the site's widget -> Secret key."
turnstile=""
state="$(key_state turnstile-secret)"
while :; do
  case "$state" in
    saved) ask_secret "Turnstile secret key (hidden; Enter keeps the saved key): " ;;
    unknown) ask_secret "Turnstile secret key (hidden; Enter keeps whatever Key Vault has): " ;;
    *) ask_secret "Turnstile secret key (hidden; Enter to add it later): " ;;
  esac
  if [ -z "$answer" ]; then
    if [ "$state" = missing ]; then
      echo "Note: the chat refuses every message until this key is saved (run the script again then)."
    else
      echo "Keeping the saved Turnstile key."
    fi
    break
  fi
  verdict="$(curl -sS --max-time 20 https://challenges.cloudflare.com/turnstile/v0/siteverify \
    --data-urlencode "secret=$answer" --data-urlencode "response=setup-check" 2>/dev/null || true)"
  if [[ "$verdict" == *invalid-input-secret* ]]; then
    echo "Cloudflare does not know this secret key (the Site key is a different one). Copy the Secret key again."
    continue
  fi
  turnstile="$answer"
  echo "Turnstile key accepted."
  break
done

# --- Azure ----------------------------------------------------------------------

echo
echo "Creating resource group $group in $location..."
az group create --name "$group" --location "$location" --output none

echo "Deploying (Function App, storage, Key Vault, email; model on $provider). This takes 2-15 minutes..."
outputs="$(az deployment group create \
  --resource-group "$group" \
  --name kanails-chat \
  --template-file "$here/chat.bicep" \
  --parameters emailTo="$email_to" allowedOrigins="$origins" modelProvider="$provider" \
    openRouterModel="$model" claudeOrganizationName="$org_name" claudeCountryCode="$country" \
  --query properties.outputs --output json --only-show-errors)"
value() { echo "$outputs" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1']['value'])"; }

app_name="$(value functionAppName)"
app_principal="$(value functionAppPrincipalId)"
vault="$(value keyVaultName)"

# grant PRINCIPAL TYPE ROLE SCOPE: says so when Azure refuses; an existing
# assignment is fine.
grant() {
  local out
  if out="$(az role assignment create --assignee-object-id "$1" --assignee-principal-type "$2" \
    --role "$3" --scope "$4" --output none --only-show-errors 2>&1)" || [[ "$out" == *xists* ]]; then
    return 0
  fi
  echo "Warning: could not grant \"$3\": ${out:0:300}"
  return 1
}

# Email: the Function App may send through Communication Services.
grant "$app_principal" ServicePrincipal "Communication and Email Service Owner" \
  "$(value communicationId)" || echo "Requests reach Telegram only until that role is granted."

# Key Vault: let you (the signed-in user) write the keys.
grant "$(az ad signed-in-user show --query id -o tsv)" User "Key Vault Secrets Officer" \
  "$(az keyvault show -n "$vault" --query id -o tsv)" || true

# put NAME VALUE: stores a key. New access can take minutes to apply.
put() {
  local attempt
  for attempt in $(seq 1 30); do
    if az keyvault secret set --vault-name "$vault" -n "$1" --value "$2" --output none 2>/dev/null; then
      return 0
    fi
    if [ "$attempt" = 1 ]; then
      echo "Waiting for access to Key Vault (up to 5 minutes the first time)..."
    fi
    sleep 10
  done
  az keyvault secret set --vault-name "$vault" -n "$1" --value "$2" --output none
}

if [ -n "$openrouter_key" ]; then put openrouter-api-key "$openrouter_key"; fi
if [ -n "$tg_token" ]; then
  put telegram-bot-token "$tg_token"
  put telegram-chat-id "$chat_id"
fi
if [ -n "$turnstile" ]; then put turnstile-secret "$turnstile"; fi

# Re-read Key Vault references now that the keys exist.
az functionapp restart -g "$group" -n "$app_name" --output none

cat <<EOF

Done. Add these in GitHub (repository KA-nails -> Settings -> Secrets and variables -> Actions -> Variables):

  AZURE_CLIENT_ID        $(value deployClientId)
  AZURE_TENANT_ID        $(value tenantId)
  AZURE_SUBSCRIPTION_ID  $(value subscriptionId)
  CHAT_FUNCTION_APP      $app_name
  CHAT_API_URL           $(value chatApiUrl)
  TURNSTILE_SITE_KEY     the site key of the same Turnstile widget

Then run Actions -> chat-api -> Run workflow, and re-run the latest "ci" run on main
so the website shows the chat button.
Model: $model on $provider.
Requests are emailed from $(value emailSender) to $email_to.
The chat answers only: $origins
EOF
