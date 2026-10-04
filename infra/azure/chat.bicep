// KA Nails AI receptionist (chat-api/) in Azure.
//
// One resource group holds everything the chat needs:
// - Microsoft Foundry account with a Claude Haiku 4.5 deployment (Hosted on
//   Azure, billed through Azure Marketplace);
// - a Flex Consumption Function App running chat-api (scales to zero);
// - a storage account for the Functions host, the deployment package and the
//   requests/usage tables;
// - Key Vault for the Telegram bot token, chat id and Turnstile secret;
// - Communication Services with an Azure-managed email domain;
// - a deployment identity that GitHub Actions uses without passwords (OIDC).
//
// Every service is reached with managed identities; no keys are stored.
// Deploy with infra/azure/setup-chat.sh (Azure Cloud Shell).

targetScope = 'resourceGroup'

@description('Region. Claude Haiku 4.5 is offered in eastus2 and swedencentral.')
param location string = 'eastus2'

@description('Short prefix for resource names.')
@maxLength(10)
param baseName string = 'kanails'

@description('Website origins allowed to call the chat API, comma-separated.')
param allowedOrigins string = 'https://ka-nails.pages.dev'

@description('Where request emails go (the studio mailbox).')
param emailTo string

@description('Legal name of the organization using Claude (Anthropic Marketplace attestation).')
param claudeOrganizationName string

@description('Two-letter country code of that organization.')
param claudeCountryCode string = 'US'

@description('Industry of that organization (technology, finance, healthcare, education, retail, manufacturing, government, media, other).')
param claudeIndustry string = 'other'

@description('Claude Haiku capacity in thousands of tokens per minute.')
param claudeCapacity int = 10

@description('Messages per UTC day after which the chat answers with a fallback.')
param dailyMessageLimit int = 500

@description('GitHub repository allowed to deploy the Function App (owner/name).')
param githubRepository string = 'alexeyalexandrov2026-tech/KA-nails'

var suffix = uniqueString(resourceGroup().id)
var storageName = take('${baseName}chat${suffix}', 24)
var functionAppName = '${baseName}-chat-${take(suffix, 6)}'
var foundryName = '${baseName}-ai-${take(suffix, 6)}'
var keyVaultName = take('${baseName}-kv-${suffix}', 24)
var claudeDeploymentName = 'claude-haiku-4-5'

// Built-in role definition IDs.
var roles = {
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  storageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  websiteContributor: 'de139f84-1756-47ae-9be6-808fbbe84772'
}

// --- Storage -----------------------------------------------------------------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deployments'
}

// --- Monitoring ----------------------------------------------------------------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-chat-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${baseName}-chat-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

// --- Key Vault (secrets are added by setup-chat.sh, never by this file) --------

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
  }
}

// --- Claude in Microsoft Foundry --------------------------------------------------

resource foundry 'Microsoft.CognitiveServices/accounts@2025-10-01-preview' = {
  name: foundryName
  location: location
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    customSubDomainName: foundryName
    allowProjectManagement: true
    publicNetworkAccess: 'Enabled'
    // Keyless only: the Function App signs in with its managed identity.
    disableLocalAuth: true
  }
}

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-10-01-preview' = {
  parent: foundry
  name: '${baseName}-chat'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {}
}

resource claude 'Microsoft.CognitiveServices/accounts/deployments@2025-10-01-preview' = {
  parent: foundry
  name: claudeDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: claudeCapacity
  }
  properties: {
    model: {
      format: 'Anthropic'
      name: 'claude-haiku-4-5'
      version: '1'
    }
    // Accepts the Anthropic Marketplace offer for this organization. The
    // property is real (Azure-Samples/claude uses it) but missing from the
    // published type definitions, hence the suppressed warning.
    #disable-next-line BCP037
    modelProviderData: {
      organizationName: claudeOrganizationName
      countryCode: claudeCountryCode
      industry: claudeIndustry
    }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  dependsOn: [foundryProject]
}

// --- Email (Azure Communication Services) ---------------------------------------

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${baseName}-email'
  location: 'global'
  properties: { dataLocation: 'United States' }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${baseName}-comms-${take(suffix, 6)}'
  location: 'global'
  properties: {
    dataLocation: 'United States'
    linkedDomains: [emailDomain.id]
  }
}

// --- Function App (Flex Consumption) ----------------------------------------------

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${baseName}-chat-plan'
  location: location
  kind: 'functionapp'
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: { reserved: true }
}

var keyVaultRef = 'VaultName=${vault.name}'

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storage.name }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'ALLOWED_ORIGINS', value: allowedOrigins }
        { name: 'FOUNDRY_RESOURCE', value: foundry.name }
        { name: 'FOUNDRY_DEPLOYMENT', value: claude.name }
        { name: 'STORAGE_TABLE_ENDPOINT', value: storage.properties.primaryEndpoints.table }
        { name: 'ACS_ENDPOINT', value: 'https://${communication.properties.hostName}' }
        { name: 'EMAIL_SENDER', value: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}' }
        { name: 'EMAIL_TO', value: emailTo }
        { name: 'DAILY_MESSAGE_LIMIT', value: string(dailyMessageLimit) }
        { name: 'TELEGRAM_BOT_TOKEN', value: '@Microsoft.KeyVault(${keyVaultRef};SecretName=telegram-bot-token)' }
        { name: 'TELEGRAM_CHAT_ID', value: '@Microsoft.KeyVault(${keyVaultRef};SecretName=telegram-chat-id)' }
        { name: 'TURNSTILE_SECRET', value: '@Microsoft.KeyVault(${keyVaultRef};SecretName=turnstile-secret)' }
      ]
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainer.name}'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 10
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
  }
}

// --- What the Function App may use ------------------------------------------------

resource appBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, app.id, roles.storageBlobDataOwner)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataOwner)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, app.id, roles.storageQueueDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageQueueDataContributor)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appTable 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, app.id, roles.storageTableDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageTableDataContributor)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, app.id, roles.keyVaultSecretsUser)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appClaude 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, app.id, roles.cognitiveServicesUser)
  scope: foundry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesUser)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// --- Passwordless deployment from GitHub Actions ------------------------------------

resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-chat-deployer'
  location: location
}

resource deployerFromMain 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployer
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:ref:refs/heads/main'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource deployerWebsite 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(app.id, deployer.id, roles.websiteContributor)
  scope: app
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.websiteContributor)
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployerBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, deployer.id, roles.storageBlobDataOwner)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataOwner)
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// --- Values for setup-chat.sh, GitHub and the website ---------------------------------

output functionAppName string = app.name
output functionAppPrincipalId string = app.identity.principalId
output chatApiUrl string = 'https://${app.properties.defaultHostName}'
output keyVaultName string = vault.name
output communicationName string = communication.name
output emailSender string = 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
output deployClientId string = deployer.properties.clientId
output tenantId string = subscription().tenantId
output subscriptionId string = subscription().subscriptionId
