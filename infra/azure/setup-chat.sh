#!/usr/bin/env bash
# One-time setup of the KA Nails AI receptionist in Azure.
# Run it in Azure Cloud Shell (portal.azure.com -> the >_ button, Bash):
#
#   git clone https://github.com/alexeyalexandrov2026-tech/KA-nails.git
#   bash KA-nails/infra/azure/setup-chat.sh
#
# It asks a few questions, creates everything from chat.bicep, stores the
# OpenRouter key and Telegram details in Key Vault (typed here, never saved in
# files or chat), and prints the values to add in GitHub. Re-running it is safe.
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

echo "KA Nails AI receptionist setup"
echo "Subscription: $(az account show --query name -o tsv)"
read -rp "Studio email that receives requests: " email_to
org_name=""
country="US"
model="$default_model"
if [ "$provider" = "foundry" ]; then
  read -rp "Legal name of the business using Claude (for the Anthropic terms): " org_name
  read -rp "Country code of the business [US]: " country
  country="${country:-US}"
else
  read -rp "OpenRouter model id (must support tool calling) [$default_model]: " model
  model="${model:-$default_model}"
fi
# The API answers only these websites; add the studio domain (and its www
# form) here, and as SITE_URL in GitHub, once it has one.
read -rp "Website address(es) allowed to use the chat, comma-separated [https://ka-nails.pages.dev]: " origins
origins="${origins:-https://ka-nails.pages.dev}"

echo "Creating resource group $group in $location..."
az group create --name "$group" --location "$location" --output none

echo "Deploying (Function App, storage, Key Vault, email; model on $provider). This takes 5-15 minutes..."
outputs="$(az deployment group create \
  --resource-group "$group" \
  --name kanails-chat \
  --template-file "$here/chat.bicep" \
  --parameters emailTo="$email_to" allowedOrigins="$origins" modelProvider="$provider" \
    openRouterModel="$model" claudeOrganizationName="$org_name" claudeCountryCode="$country" \
  --query properties.outputs --output json)"
value() { echo "$outputs" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1']['value'])"; }

app_name="$(value functionAppName)"
app_principal="$(value functionAppPrincipalId)"
vault="$(value keyVaultName)"
comms="$(value communicationName)"

# Email: the Function App may send through Communication Services.
az role assignment create \
  --assignee-object-id "$app_principal" --assignee-principal-type ServicePrincipal \
  --role "Communication and Email Service Owner" \
  --scope "$(az communication show -g "$group" -n "$comms" --query id -o tsv)" \
  --output none 2>/dev/null || true

# Key Vault: let you (the signed-in user) write the secrets once.
me="$(az ad signed-in-user show --query id -o tsv)"
az role assignment create --assignee-object-id "$me" --assignee-principal-type User \
  --role "Key Vault Secrets Officer" \
  --scope "$(az keyvault show -n "$vault" --query id -o tsv)" --output none 2>/dev/null || true
echo "Waiting a minute for access to apply..."
sleep 60

if [ "$provider" != "foundry" ]; then
  echo
  echo "OpenRouter: openrouter.ai -> Settings -> Keys -> Create key."
  read -rsp "OpenRouter API key (hidden while typing): " or_key; echo
  az keyvault secret set --vault-name "$vault" -n openrouter-api-key --value "${or_key:-none}" --output none
fi

echo
echo "Telegram: create the studio bot with @BotFather, then write /start to it from Karina's Telegram."
read -rsp "Telegram bot token (hidden while typing): " tg_token; echo
chat_id="$(curl -fsS "https://api.telegram.org/bot${tg_token}/getUpdates" |
  python3 -c "import json,sys; r=json.load(sys.stdin).get('result',[]); print(next((str(u['message']['chat']['id']) for u in reversed(r) if 'message' in u), ''))")"
if [ -z "$chat_id" ]; then
  read -rp "No /start message found. Telegram chat id: " chat_id
else
  echo "Found the chat id from Karina's /start message."
fi
az keyvault secret set --vault-name "$vault" -n telegram-bot-token --value "$tg_token" --output none
az keyvault secret set --vault-name "$vault" -n telegram-chat-id --value "$chat_id" --output none

echo
echo "Cloudflare Turnstile is required: in the Cloudflare dashboard, add a Managed widget for the website address(es) above."
read -rsp "Turnstile secret key (hidden while typing; Enter to add it later): " turnstile; echo
az keyvault secret set --vault-name "$vault" -n turnstile-secret --value "${turnstile:-none}" --output none
if [ -z "$turnstile" ]; then
  echo "Note: the chat refuses every message until the Key Vault secret turnstile-secret is set"
  echo "(then restart the Function App) and TURNSTILE_SITE_KEY is set in GitHub."
fi

# Re-read Key Vault references now that the secrets exist.
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
