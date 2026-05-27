interface Flag {
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  recommendedAction?: string;
}

interface AnalysisResult {
  flags: Flag[];
  structuredData: Record<string, unknown>;
}

const CRITICAL_KEYWORDS = [
  { pattern: /chest\s*pain/i, severity: "critical" as const, category: "Cardiac", description: "Patient reported chest pain", recommendedAction: "Contact physician immediately" },
  { pattern: /can't\s*breath|difficulty\s*breath|short\s*of\s*breath/i, severity: "critical" as const, category: "Respiratory", description: "Patient reported breathing difficulty", recommendedAction: "Contact physician immediately" },
  { pattern: /severe\s*pain|10\s*out\s*of\s*10\s*pain/i, severity: "high" as const, category: "Pain", description: "Patient reported severe pain", recommendedAction: "Contact physician within 2 hours" },
  { pattern: /fever|temperature|chills/i, severity: "high" as const, category: "Infection", description: "Patient reported fever or chills", recommendedAction: "Assess wound site; contact physician if >101°F" },
  { pattern: /bleed|bleeding|blood/i, severity: "high" as const, category: "Bleeding", description: "Patient reported bleeding", recommendedAction: "Assess site; contact surgeon if excessive" },
  { pattern: /allergic|reaction|rash|swelling/i, severity: "medium" as const, category: "Allergic Reaction", description: "Patient reported allergic reaction symptoms", recommendedAction: "Monitor and contact physician if worsening" },
  { pattern: /didn't\s*take|not\s*taking|stopped\s*medication/i, severity: "medium" as const, category: "Medication Compliance", description: "Patient reported medication non-compliance", recommendedAction: "Counsel patient on medication adherence" },
  { pattern: /ate|food|drink|water/i, severity: "medium" as const, category: "NPO Compliance", description: "Patient may have violated NPO instructions", recommendedAction: "Verify fasting status before procedure" },
];

class TranscriptAnalyzer {
  async analyze(transcript: string, callType: string): Promise<AnalysisResult> {
    if (!process.env.OPENAI_API_KEY) {
      return this.localAnalyze(transcript, callType);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a clinical AI assistant reviewing peri-operative phone call transcripts. 
Extract key clinical information and flag any concerns.
Return JSON with: { "flags": [{ "severity": "low|medium|high|critical", "category": string, "description": string, "recommendedAction": string }], "structuredData": { "painLevel": number|null, "medicationCompliance": boolean|null, "npoCompliance": boolean|null, "woundCondition": string|null, "concerns": string[] } }`,
            },
            {
              role: "user",
              content: `Call type: ${callType}\n\nTranscript:\n${transcript}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
          flags: parsed.flags ?? [],
          structuredData: parsed.structuredData ?? {},
        };
      }
    } catch {
      // fall back to local analysis
    }

    return this.localAnalyze(transcript, callType);
  }

  private localAnalyze(transcript: string, _callType: string): AnalysisResult {
    const flags: Flag[] = [];
    const lower = transcript.toLowerCase();

    for (const keyword of CRITICAL_KEYWORDS) {
      if (keyword.pattern.test(transcript)) {
        flags.push({
          severity: keyword.severity,
          category: keyword.category,
          description: keyword.description,
          recommendedAction: keyword.recommendedAction,
        });
      }
    }

    const painMatch = lower.match(/(\d+)\s*(?:out\s*of\s*10|\/\s*10)/);
    const painLevel = painMatch ? Number(painMatch[1]) : null;

    return {
      flags,
      structuredData: {
        painLevel,
        medicationCompliance: !lower.includes("didn't take") && !lower.includes("not taking"),
        concerns: flags.map(f => f.description),
      },
    };
  }
}

export const transcriptAnalyzer = new TranscriptAnalyzer();
