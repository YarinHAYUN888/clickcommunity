/**
 * Contract B: Edge → n8N webhook POST shape.
 * Gmail node expects: $('Webhook').item.json.body.email
 */

import type { OtpDeliveryChannel } from "./webhookDispatch.ts";

export type OtpApiChannel = "email" | "sms";

export function toApiChannel(internal: OtpDeliveryChannel): OtpApiChannel {
  return internal === "email" ? "email" : "sms";
}

/** POST root sent to n8n webhook — nested body.* for Gmail + optional top-level email duplicate. */
export function buildN8nWebhookEnvelope(
  internalChannel: OtpDeliveryChannel,
  code: string,
  challengeId: string,
  destination: string,
  edgeBody: Record<string, unknown>,
  registrationSessionId: string | null,
): Record<string, unknown> {
  const apiChannel = toApiChannel(internalChannel);

  const innerBody: Record<string, unknown> = {
    channel: apiChannel,
    code,
    purpose: "registration",
    challengeId,
    registration_session_id: registrationSessionId,
    verificationMethod: apiChannel,
    event: "otp_send",
    action: "send",
    firstName: edgeBody.firstName ?? "",
    lastName: edgeBody.lastName ?? "",
  };

  if (internalChannel === "email") {
    innerBody.email = destination;
  } else {
    innerBody.phone = destination;
    innerBody.gender = edgeBody.gender ?? "";
    innerBody.dateOfBirth = edgeBody.dateOfBirth ?? null;
    innerBody.region = edgeBody.region ?? "";
    innerBody.regionOther = edgeBody.regionOther ?? "";
    innerBody.occupation = edgeBody.occupation ?? "";
    innerBody.bio = edgeBody.bio ?? "";
    innerBody.instagram = edgeBody.instagram ?? "";
    innerBody.tiktok = edgeBody.tiktok ?? "";
    innerBody.interests = edgeBody.interests ?? [];
  }

  const envelope: Record<string, unknown> = { body: innerBody };

  if (internalChannel === "email" && destination) {
    envelope.email = destination;
  }

  return envelope;
}
