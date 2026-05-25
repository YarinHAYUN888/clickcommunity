export type RequestMeta = {
  ipHash: string | null;
  userAgentHash: string | null;
};

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

export async function getRequestMeta(req: Request): Promise<RequestMeta> {
  const salt = Deno.env.get("SECURITY_HASH_SALT") ?? "clicks-security-v1";
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent")?.trim() || null;
  return {
    ipHash: ip ? await digest(`${salt}:ip:${ip}`) : null,
    userAgentHash: ua ? await digest(`${salt}:ua:${ua}`) : null,
  };
}
