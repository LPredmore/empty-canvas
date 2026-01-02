import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

// Build the system prompt dynamically based on existing people
function buildSystemPrompt(existingPeople: Array<{ id: string; name: string; role: string; roleContext?: string }> = []): string {
  const existingPeopleSection = existingPeople.length > 0
    ? `
EXISTING PEOPLE IN THE SYSTEM:
The following people are already recorded in the user's system. When you extract people from the document, check if they match any of these existing entries. If a person in the document matches an existing person, include their exact name AND set "suggestedExistingPersonId" to the matching person's id.

${existingPeople.map(p => `- ID: "${p.id}" | Name: "${p.name}" | Role: ${p.role}${p.roleContext ? ` | Context: ${p.roleContext}` : ''}`).join('\n')}

IMPORTANT: Extract ALL people mentioned in the document, including those who match existing entries. For matches, set suggestedExistingPersonId. For new people, leave it null.
`
    : '';

  return `You are a legal document analyst specializing in family law. Your task is to extract ALL relevant information from legal documents (parenting plans, custody orders, court orders, stipulations, etc.).

You must be EXHAUSTIVE and extract EVERY detail that could be relevant for co-parenting. Do not summarize or omit anything.
${existingPeopleSection}
Return your analysis as a JSON object with this exact structure:

{
  "metadata": {
    "suggestedTitle": "string - descriptive title for this document",
    "documentType": "parenting_plan" | "court_order" | "stipulation" | "agreement" | "other",
    "courtName": "string or null - full court name if mentioned",
    "caseNumber": "string or null - case/docket number if mentioned",
    "jurisdiction": "string or null - state/county/jurisdiction",
    "effectiveDate": "YYYY-MM-DD or null - when terms become effective",
    "signedDate": "YYYY-MM-DD or null - when document was signed"
  },
  "extractedPeople": [
    {
      "name": "string - full name as appears in document",
      "suggestedRole": "Parent" | "Child" | "StepParent" | "Clinician" | "Legal" | "Other",
      "context": "string - MUST specify relationships BY NAME. Example: 'Biological mother of: Bryant Predmore, Brylee Predmore, Bryce Predmore' NOT just 'biological mother'. Include legal designation (Petitioner/Respondent) if applicable.",
      "suggestedExistingPersonId": "string or null - the ID of the matching existing person if this person is already in the system, otherwise null"
    }
  ],
  "operationalAgreements": [
    {
      "topic": "string - specific topic name",
      "category": "decision_making" | "parenting_time" | "holiday_schedule" | "school" | "communication" | "financial" | "travel" | "right_of_first_refusal" | "exchange" | "medical" | "extracurricular" | "technology" | "third_party" | "dispute_resolution" | "modification" | "other",
      "fullText": "string - the complete relevant text WITH NAMES SUBSTITUTED. Replace 'Mother' with the mother's actual name, 'Father' with the father's actual name throughout.",
      "summary": "string - 1-2 sentence summary WITH ACTUAL NAMES, not 'Mother'/'Father'"
    }
  ],
  "partyNameMap": {
    "Mother": "string - the mother's full name as identified in the document",
    "Father": "string - the father's full name as identified in the document",
    "Petitioner": "string - the petitioner's full name",
    "Respondent": "string - the respondent's full name"
  }
}

CRITICAL EXTRACTION GUIDELINES:

**People to Extract (EXTRACT EVERYONE):**
- All parents/guardians (Mother, Father, Step-parents) - identify by full name
- All children mentioned by name - include ages if stated
- Attorneys for either party
- Judges or magistrates
- Therapists, counselors, mediators
- Guardian ad litem
- Parenting coordinators
- Any other named individuals

**CONTEXT FIELD - MUST BE SPECIFIC:**
For each person's "context" field, you MUST specify WHO they are related to by name:
- WRONG: "biological mother" or "Petitioner"
- CORRECT: "Petitioner. Biological mother of: Bryant Predmore (age 12), Brylee Predmore (age 10), Bryce Predmore (age 8)"
- WRONG: "family therapist"  
- CORRECT: "Family therapist for Bryant Predmore and Brylee Predmore, appointed by court"
- WRONG: "Step-parent"
- CORRECT: "Step-father of Bryant Predmore, Brylee Predmore, Bryce Predmore. Married to Allison Wilson."

**NAME SUBSTITUTION IN AGREEMENTS:**
When extracting operationalAgreements, you MUST replace generic party references with actual names:
- Replace "Mother" with the mother's actual name (e.g., "Allison Wilson")
- Replace "Father" with the father's actual name (e.g., "Lucas Predmore")
- Replace "Petitioner"/"Respondent" with actual names
- Keep children's names as they appear

**Operational Agreements to Extract (BE EXHAUSTIVE):**

For DECISION MAKING:
- Who has sole/joint legal decision-making authority
- Education decisions
- Medical/healthcare decisions
- Religious/spiritual decisions
- Extracurricular activity decisions
- Which parent has final say in disputes

For PARENTING TIME:
- Regular weekly schedule
- Weekday/weekend allocation
- Specific times for pickup/dropoff
- Overnight arrangements
- Summer schedule differences

For HOLIDAY SCHEDULE:
- Each holiday individually (Christmas, Thanksgiving, Easter, etc.)
- School breaks (spring break, winter break, summer)
- Parent birthdays
- Children's birthdays
- Mother's Day / Father's Day
- Three-day weekends
- Alternating patterns (even/odd years)

For SCHOOL:
- Which school(s) children attend
- School district
- Who handles school communications
- Transportation to/from school
- Homework responsibilities
- School event attendance

For COMMUNICATION:
- How parents must communicate with each other
- Required notice periods
- Allowed communication methods (email, OFW, text)
- Children's communication with non-custodial parent
- Phone/video call schedules

For FINANCIAL:
- Child support amounts and schedule
- Health insurance responsibility
- Uninsured medical expense sharing
- Extracurricular cost sharing
- School expense sharing
- Tax dependency exemptions
- College savings

For TRAVEL:
- Domestic travel notification requirements
- International travel restrictions
- Passport rules
- Required consents

For RIGHT OF FIRST REFUSAL:
- Time threshold (e.g., 4+ hours)
- How to offer/accept
- Who qualifies as approved caregiver

For EXCHANGE:
- Pickup/dropoff locations
- Who transports
- Timing requirements
- What items travel with children

For MEDICAL:
- Insurance carrier
- How to select providers
- Emergency protocols
- Therapy/counseling rules
- Medication decisions

For EXTRACURRICULAR:
- Enrollment approval process
- Cost sharing
- Transportation responsibilities
- Activity limits

For TECHNOLOGY:
- Screen time rules
- Social media restrictions
- Phone ownership/access
- Monitoring agreements

For THIRD PARTY:
- Restrictions on overnight guests
- Restrictions on specific individuals
- Introduction of new partners

For DISPUTE RESOLUTION:
- Mediation requirements
- Arbitration clauses
- Parenting coordinator role
- Court as last resort

For MODIFICATION:
- How changes must be requested
- Mutual agreement requirements
- Notice periods for modifications

Extract EVERY provision you find. It is better to over-extract than to miss something.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      documentContent, 
      images, 
      fileName, 
      mimeType, 
      totalPages,
      extractedPages,
      wasTruncated,
      isScanned,
      existingPeople,  // NEW: Array of existing people for matching
      additionalQuery  // NEW: Optional query for targeted re-extraction
    } = body;

    if (!documentContent && !images) {
      throw new Error('Document content or images are required');
    }

    console.log(`Processing legal document: ${fileName}, type: ${mimeType}, scanned: ${isScanned || false}`);
    if (totalPages) {
      console.log(`Total pages: ${totalPages}, extracted: ${extractedPages || 'N/A'}, truncated: ${wasTruncated || false}`);
    }
    if (existingPeople?.length) {
      console.log(`Provided ${existingPeople.length} existing people for matching`);
    }
    if (additionalQuery) {
      console.log(`Additional extraction query: "${additionalQuery}"`);
    }

    // Build system prompt with existing people context
    const systemPrompt = buildSystemPrompt(existingPeople || []);

    let userContent: any[];
    
    if (images && Array.isArray(images) && images.length > 0) {
      // Multi-image content for scanned PDFs
      console.log(`Processing ${images.length} page images via Vision API...`);
      
      const imageContents = images.map((img: string, idx: number) => ({
        type: 'image_url',
        image_url: {
          url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
        }
      }));

      let instructionText = `Analyze this legal document (${images.length} page${images.length > 1 ? 's' : ''}) and extract all information according to your instructions. File: ${fileName}`;
      
      if (totalPages && totalPages > images.length) {
        instructionText += ` (Note: Document has ${totalPages} pages total, only first ${images.length} are shown)`;
      }
      
      if (additionalQuery) {
        instructionText += `\n\nADDITIONAL FOCUS: The user specifically wants you to look for agreements related to: "${additionalQuery}". Extract any provisions matching this query that may have been missed in prior extraction.`;
      }

      userContent = [
        { type: 'text', text: instructionText },
        ...imageContents
      ];
    } else if (documentContent) {
      // Text-based content
      console.log(`Processing text content (${documentContent.length} chars)...`);
      
      let contextNote = '';
      if (wasTruncated) {
        contextNote = `\n\nNOTE: This document has been truncated for processing. Original document has ${totalPages} pages, but only ${extractedPages} pages are included below. Extract as much information as possible from the available content.`;
      }
      
      if (additionalQuery) {
        contextNote += `\n\nADDITIONAL FOCUS: The user specifically wants you to look for agreements related to: "${additionalQuery}". Extract any provisions matching this query that may have been missed in prior extraction.`;
      }

      userContent = [
        {
          type: 'text',
          text: `Analyze this legal document and extract all information according to your instructions.${contextNote}

Document: ${fileName}

Content:
${documentContent}`
        }
      ];
    } else {
      throw new Error('Invalid request: no content provided');
    }

    console.log('Calling OpenRouter API for document analysis...');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Co-Parenting Assistant'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Parse error for more helpful message
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          if (errorJson.error.message.includes('context length')) {
            errorMessage = 'Document is too large to process. Please try a shorter document or contact support.';
          } else {
            errorMessage = errorJson.error.message;
          }
        }
      } catch {
        // Keep default error message
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in API response');
    }

    console.log('Received response, parsing JSON...');

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw content:', content.substring(0, 500));
      throw new Error('Failed to parse document analysis result');
    }

    // Validate and normalize the result
    const normalizedResult = {
      metadata: {
        suggestedTitle: result.metadata?.suggestedTitle || fileName || 'Untitled Document',
        documentType: result.metadata?.documentType || 'other',
        courtName: result.metadata?.courtName || null,
        caseNumber: result.metadata?.caseNumber || null,
        jurisdiction: result.metadata?.jurisdiction || null,
        effectiveDate: result.metadata?.effectiveDate || null,
        signedDate: result.metadata?.signedDate || null
      },
      extractedPeople: Array.isArray(result.extractedPeople) ? result.extractedPeople : [],
      legalClauses: [], // Deprecated - always return empty array
      operationalAgreements: Array.isArray(result.operationalAgreements) ? result.operationalAgreements : [],
      partyNameMap: result.partyNameMap || {}
    };

    console.log(`Extracted: ${normalizedResult.extractedPeople.length} people, ${normalizedResult.operationalAgreements.length} agreements`);
    console.log(`Party name map: ${JSON.stringify(normalizedResult.partyNameMap)}`);

    return new Response(
      JSON.stringify(normalizedResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
    console.error('Error processing legal document:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
