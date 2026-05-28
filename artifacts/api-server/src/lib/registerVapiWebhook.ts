import { logger } from "./logger";

interface VapiAssistantServerConfig {
  url: string;
  secret?: string;
}

interface VapiAssistantPatch {
  server: VapiAssistantServerConfig;
}

async function patchVapiAssistant(assistantId: string, apiKey: string, patch: VapiAssistantPatch): Promise<void> {
  const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vapi API error ${response.status}: ${body}`);
  }
}

export async function registerVapiWebhook(): Promise<void> {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;

  if (!apiKey || !assistantId) {
    logger.warn(
      "VAPI_API_KEY or VAPI_ASSISTANT_ID not set — skipping automatic webhook registration. " +
      "Set these secrets and restart the server to register the webhook with Vapi automatically."
    );
    return;
  }

  if (!devDomain) {
    logger.warn("REPLIT_DEV_DOMAIN not available — cannot construct webhook URL for Vapi registration.");
    return;
  }

  const webhookUrl = `https://${devDomain}/api/vapi/webhook`;
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn(
      "VAPI_WEBHOOK_SECRET is not set. Webhooks will be accepted without signature verification, " +
      "which means any caller can send fabricated events. " +
      "Generate a secret, set it in Replit Secrets as VAPI_WEBHOOK_SECRET, " +
      "and paste the same value into your Vapi dashboard under Assistant → Server → Secret."
    );
  }

  const serverConfig: VapiAssistantServerConfig = { url: webhookUrl };
  if (secret) {
    serverConfig.secret = secret;
  }

  try {
    await patchVapiAssistant(assistantId, apiKey, { server: serverConfig });
    logger.info(
      { webhookUrl, secretConfigured: !!secret },
      "Vapi assistant webhook URL registered successfully"
    );
  } catch (err) {
    logger.error(
      { err, webhookUrl },
      "Failed to register webhook URL with Vapi — call results will not flow back until this is resolved. " +
      "Check VAPI_API_KEY and VAPI_ASSISTANT_ID, or configure the webhook URL manually in the Vapi dashboard."
    );
  }
}
