import type { Patient, Procedure } from "@workspace/db/schema";

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

class VapiClient {
  private apiKey: string | undefined;
  private baseUrl = "https://api.vapi.ai";

  constructor() {
    this.apiKey = process.env.VAPI_API_KEY;
  }

  async initiateCall({ phone, callType, patient, procedure }: InitiateCallParams): Promise<VapiCallResult | null> {
    if (!this.apiKey) {
      console.log(`[VapiClient STUB] Would call ${phone} for ${callType} - ${patient.firstName} ${patient.lastName}`);
      return { id: `stub_${Date.now()}`, status: "queued" };
    }

    const response = await fetch(`${this.baseUrl}/call/phone`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: phone, name: `${patient.firstName} ${patient.lastName}` },
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
      throw new Error(`Vapi API error: ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<VapiCallResult>;
  }
}

export const vapiClient = new VapiClient();
