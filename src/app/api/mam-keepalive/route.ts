import { NextRequest, NextResponse } from "next/server";
import { getServerEnvVariables } from "@/lib/env";

const MAM_ERROR_CODES: Record<string, { code: number; description: string }> = {
  "No Session Cookie": {
    code: 403,
    description: "Didn't properly provide the mam_id session cookie",
  },
  "Invalid session": {
    code: 403,
    description: "System deemed the session invalid (bad mam_id value, or you've moved off the locked IP/ASN)",
  },
  "Invalid session - IP mismatch": {
    code: 403,
    description: "Session is locked to a single IP address, and you are not accessing from it",
  },
  "Invalid session - ASN mismatch": {
    code: 403,
    description: "Session is locked to a list of ASNs, but you are accessing from a different one",
  },
  "Invalid session - Invalid Cookie": {
    code: 403,
    description: "System could not decode the cookie. Bad/corrupted value",
  },
  "Last Change too recent": {
    code: 429,
    description: "You've changed too recently. Try again later",
  },
};

async function getMamToken(): Promise<string | undefined> {
  const { MAM_TOKEN: envToken, MOUSEHOLE_ENDPOINT } = getServerEnvVariables();

  // If Mousehole is configured, fetch the token from there
  if (MOUSEHOLE_ENDPOINT) {
    try {
      console.log("[MAM Keepalive] Fetching token from Mousehole:", MOUSEHOLE_ENDPOINT);
      const response = await fetch(`${MOUSEHOLE_ENDPOINT}/state`);
      if (!response.ok) {
        console.error(
          `[MAM Keepalive] Failed to fetch from Mousehole: ${response.status}`,
        );
        return envToken;
      }
      const data = await response.json();
      if (data.currentCookie) {
        console.log("[MAM Keepalive] Got token from Mousehole");
        return data.currentCookie;
      }
    } catch (error) {
      console.error("[MAM Keepalive] Error fetching token from Mousehole:", error);
    }
  }

  return envToken;
}

export async function POST(request: NextRequest) {
  try {
    // Get MAM token from request header (sent by client) or fall back to Mousehole/env
    const mamTokenHeader = request.headers.get("x-mam-token");
    const mamToken = mamTokenHeader || (await getMamToken());

    if (!mamToken) {
      return NextResponse.json(
        { success: false, error: "No MAM token configured" },
        { status: 400 }
      );
    }

    // Ping the MAM dynamic seedbox endpoint to keep the session alive
    const response = await fetch(
      "https://t.myanonamouse.net/json/dynamicSeedbox.php",
      {
        method: "GET",
        headers: {
          Cookie: `mam_id=${mamToken}`,
          "User-Agent": "BookGrab/1.0",
        },
      }
    );

    const text = await response.text();

    // Parse the response - MAM returns JSON with status
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // If not JSON, use the text directly
      result = { message: text };
    }

    // Check for known success responses
    const successMessages = ["Completed", "No Change"];
    const isSuccess = successMessages.some(
      (msg) => text.includes(msg) || JSON.stringify(result).includes(msg)
    );

    if (isSuccess) {
      console.log("[MAM Keepalive] Success (200):", text);
      return NextResponse.json({
        success: true,
        message: text,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for known error responses
    for (const [errorMsg, errorInfo] of Object.entries(MAM_ERROR_CODES)) {
      if (text.includes(errorMsg)) {
        const hint = errorMsg === "No Session Cookie" || errorMsg.includes("Incorrect session type")
          ? "Make sure 'Allow session to set dynamic seedbox IP' is enabled in MAM Security settings"
          : errorMsg.includes("IP mismatch")
          ? "Your IP has changed. Get a new token from MAM or update Mousehole."
          : errorMsg.includes("ASN mismatch")
          ? "Your ASN has changed. Get a new token from MAM or update Mousehole."
          : undefined;
        
        console.error(`[MAM Keepalive] ${errorInfo.code} ${errorMsg}:`, text);
        return NextResponse.json(
          {
            success: false,
            error: `${errorInfo.code} - ${errorMsg}`,
            details: errorInfo.description,
            hint,
          },
          { status: 400 }
        );
      }
    }

    // Unknown response
    console.log("[MAM Keepalive] Unknown response (200):", text);
    return NextResponse.json({
      success: true,
      message: text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[MAM Keepalive] Network/server error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
