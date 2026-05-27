export interface EhrPatient {
  ehrId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email?: string;
  mrn: string;
  language?: string;
}

export interface EhrProcedure {
  ehrId: string;
  patientEhrId: string;
  patientMrn: string;
  procedureName: string;
  procedureCode: string;
  scheduledDate: string;
  facility: string;
  surgeon: string;
  arrivalTime?: string;
  specialInstructions?: string;
}

export interface EhrConnector {
  isConfigured(): boolean;
  getUpcomingProcedures(daysAhead: number): Promise<EhrProcedure[]>;
  getPatient(ehrId: string): Promise<EhrPatient | null>;
  getProcedure(ehrId: string): Promise<EhrProcedure | null>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

class HstPathwaysConnector implements EhrConnector {
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly facilityId: string | undefined;

  constructor() {
    this.baseUrl = process.env.HST_BASE_URL;
    this.apiKey = process.env.HST_API_KEY;
    this.facilityId = process.env.HST_FACILITY_ID;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.facilityId);
  }

  private async fetch<T>(path: string): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error("HST Pathways connector is not configured. Set HST_BASE_URL, HST_API_KEY, HST_FACILITY_ID.");
    }

    const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Facility-ID": this.facilityId!,
      },
    });

    if (!response.ok) {
      throw new Error(`HST API error ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async getUpcomingProcedures(daysAhead = 7): Promise<EhrProcedure[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const from = new Date().toISOString().split("T")[0];
    const to = new Date(Date.now() + daysAhead * 86_400_000).toISOString().split("T")[0];

    try {
      const raw = await this.fetch<any[]>(`/v1/procedures?scheduledFrom=${from}&scheduledTo=${to}`);
      return raw.map((p: any) => ({
        ehrId: String(p.id),
        patientEhrId: String(p.patientId),
        patientMrn: p.mrn ?? "",
        procedureName: p.procedureName ?? p.name ?? "Unknown",
        procedureCode: p.cptCode ?? "",
        scheduledDate: p.scheduledDate,
        facility: p.facility ?? p.facilityName ?? "",
        surgeon: p.surgeon ?? p.physicianName ?? "",
        arrivalTime: p.arrivalTime,
        specialInstructions: p.notes,
      }));
    } catch (err) {
      console.error("[HstPathways] getUpcomingProcedures failed:", err);
      return [];
    }
  }

  async getPatient(ehrId: string): Promise<EhrPatient | null> {
    if (!this.isConfigured()) return null;

    try {
      const p = await this.fetch<any>(`/v1/patients/${ehrId}`);
      return {
        ehrId: String(p.id),
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth,
        phone: p.phone ?? p.mobilePhone ?? p.homePhone ?? "",
        email: p.email,
        mrn: p.mrn,
        language: p.preferredLanguage ?? "en",
      };
    } catch {
      return null;
    }
  }

  async getProcedure(ehrId: string): Promise<EhrProcedure | null> {
    if (!this.isConfigured()) return null;

    try {
      const p = await this.fetch<any>(`/v1/procedures/${ehrId}`);
      return {
        ehrId: String(p.id),
        patientEhrId: String(p.patientId),
        patientMrn: p.mrn ?? "",
        procedureName: p.procedureName ?? p.name,
        procedureCode: p.cptCode ?? "",
        scheduledDate: p.scheduledDate,
        facility: p.facility ?? p.facilityName ?? "",
        surgeon: p.surgeon ?? p.physicianName ?? "",
        arrivalTime: p.arrivalTime,
        specialInstructions: p.notes,
      };
    } catch {
      return null;
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: "HST Pathways credentials not configured (HST_BASE_URL, HST_API_KEY, HST_FACILITY_ID)" };
    }

    try {
      await this.fetch("/v1/health");
      return { ok: true, message: "Connected to HST Pathways" };
    } catch (err: any) {
      return { ok: false, message: err?.message ?? "Connection failed" };
    }
  }
}

export const ehrConnector: EhrConnector = new HstPathwaysConnector();
