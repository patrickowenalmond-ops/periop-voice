import type { Patient, Procedure } from "@workspace/db/schema";
import { logger } from "./logger";

interface InitiateCallParams {
  phone: string;
  callType: string;
  patient: Patient;
  procedure: Procedure;
}

interface VapiCallResult {
  id: string;
  status: string;
}

// Vapi requires phone numbers in E.164 format (e.g. +15551234567) with no
// dashes, spaces, or parentheses. Normalize common stored formats before use.
function toE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  // If the input already specified a country code with a leading "+", trust it.
  if (trimmed.startsWith("+")) return `+${digits}`;

  // Otherwise assume North America (NANP) and add the +1 country code.
  // 10 digits => bare US/CA number; 11 digits starting with 1 => already has it.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return `+${digits}`;
}

class VapiClient {
  private readonly baseUrl = "https://api.vapi.ai";

  get isLive(): boolean {
    return !!(
      process.env.VAPI_API_KEY &&
      process.env.VAPI_PHONE_NUMBER_ID &&
      process.env.VAPI_ASSISTANT_ID
    );
  }

  async initiateCall({ phone, callType, patient, procedure }: InitiateCallParams): Promise<VapiCallResult | null> {
    if (!this.isLive) {
      logger.warn(
        { phone, callType, patientId: patient.id },
        "[VapiClient] VAPI_API_KEY / VAPI_PHONE_NUMBER_ID / VAPI_ASSISTANT_ID not set — running in stub mode. No real call placed."
      );
      return { id: `stub_${Date.now()}`, status: "queued" };
    }

    logger.info(
      { phone, callType, patientId: patient.id, procedureId: procedure.id },
      "Initiating live Vapi outbound call"
    );

    const response = await fetch(`${this.baseUrl}/call/phone`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: toE164(phone),
          name: `${patient.firstName} ${patient.lastName}`,
        },
        assistantId: process.env.VAPI_ASSISTANT_ID,
        assistantOverrides: {
          variableValues: {
            patientFirstName: patient.firstName,
            patientLastName: patient.lastName,
            callType,
            procedureName: procedure.procedureName,
            procedureDate: procedure.scheduledDate?.toISOString(),
            surgeon: procedure.surgeon,
            facility: procedure.facility,
            arrivalTime: procedure.arrivalTime,
            specialInstructions: procedure.specialInstructions,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, "Vapi API error placing outbound call");
      throw new Error(`Vapi API error: ${response.status} ${body}`);
    }

    const result = await response.json() as VapiCallResult;
    logger.info({ vapiCallId: result.id, status: result.status }, "Vapi outbound call initiated successfully");
    return result;
  }
}

export const vapiClient = new VapiClient();
