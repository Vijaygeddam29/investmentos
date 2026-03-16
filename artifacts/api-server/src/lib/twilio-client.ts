import twilio from "twilio";

async function getCredentials() {
  // Try Replit connector first (works in dev and should work in deployment)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (hostname && xReplitToken) {
    try {
      const data = await fetch(
        "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=twilio",
        {
          headers: {
            Accept: "application/json",
            "X-Replit-Token": xReplitToken,
          },
        }
      ).then((res) => res.json());

      const item = data.items?.[0];
      if (
        item?.settings?.account_sid &&
        item?.settings?.api_key &&
        item?.settings?.api_key_secret
      ) {
        return {
          accountSid:   item.settings.account_sid as string,
          apiKey:       item.settings.api_key as string,
          apiKeySecret: item.settings.api_key_secret as string,
          phoneNumber:  (item.settings.phone_number ?? "") as string,
        };
      }
    } catch {
      // fall through to env var fallback
    }
  }

  // Fallback: plain environment variables (set these as secrets in production)
  const accountSid   = process.env.TWILIO_ACCOUNT_SID;
  const authToken    = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber  = process.env.TWILIO_PHONE_NUMBER ?? "";

  if (accountSid && authToken) {
    return { accountSid, apiKey: accountSid, apiKeySecret: authToken, phoneNumber };
  }

  throw new Error("Twilio not connected");
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  // If using auth token directly (fallback), initialise with accountSid + authToken
  if (apiKey === accountSid) {
    return twilio(accountSid, apiKeySecret);
  }
  return twilio(apiKey, apiKeySecret, { accountSid });
}

export async function getTwilioFromNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}
