import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

const SYSTEM_PROMPT = `You are a legal document analyst specializing in family law. Your task is to extract ALL relevant information from legal documents (parenting plans, custody orders, court orders, stipulations, etc.).

You must be EXHAUSTIVE and extract EVERY detail that could be relevant for co-parenting. Do not summarize or omit anything.

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
      "context": "string - description of who this person is (e.g., 'Petitioner, biological mother', 'Minor child, age 8', 'Family therapist')"
    }
  ],
  "legalClauses": [
    {
      "clauseRef": "string - section/article reference (e.g., 'Section 4.2', 'Article III.A')",
      "topic": "string - brief topic name",
      "fullText": "string - the complete text of the clause",
      "summary": "string - 1-2 sentence summary"
    }
  ],
  "operationalAgreements": [
    {
      "topic": "string - specific topic name",
      "category": "decision_making" | "parenting_time" | "holiday_schedule" | "school" | "communication" | "financial" | "travel" | "right_of_first_refusal" | "exchange" | "medical" | "extracurricular" | "technology" | "third_party" | "dispute_resolution" | "modification" | "other",
      "fullText": "string - the complete relevant text",
      "summary": "string - 1-2 sentence summary"
    }
  ]
}

EXTRACTION GUIDELINES:

**People to Extract:**
- All parents/guardians (Mother, Father, Step-parents)
- All children mentioned by name
- Attorneys for either party
- Judges or magistrates
- Therapists, counselors, mediators
- Guardian ad litem
- Parenting coordinators
- Any other named individuals

**Legal Clauses to Extract:**
- Extract each numbered/lettered section as a separate clause
- Include the exact clause reference (Section 4, Article III, etc.)
- Preserve the full legal text

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
      isScanned 
    } = body;

    if (!documentContent && !images) {
      throw new Error('Document content or images are required');
    }

    console.log(`Processing legal document: ${fileName}, type: ${mimeType}, scanned: ${isScanned || false}`);
    if (totalPages) {
      console.log(`Total pages: ${totalPages}, extracted: ${extractedPages || 'N/A'}, truncated: ${wasTruncated || false}`);
    }

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

      userContent = [
        {
          type: 'text',
          text: `Analyze this legal document (${images.length} page${images.length > 1 ? 's' : ''}) and extract all information according to your instructions. File: ${fileName}${totalPages && totalPages > images.length ? ` (Note: Document has ${totalPages} pages total, only first ${images.length} are shown)` : ''}`
        },
        ...imageContents
      ];
    } else if (documentContent) {
      // Text-based content
      console.log(`Processing text content (${documentContent.length} chars)...`);
      
      let contextNote = '';
      if (wasTruncated) {
        contextNote = `\n\nNOTE: This document has been truncated for processing. Original document has ${totalPages} pages, but only ${extractedPages} pages are included below. Extract as much information as possible from the available content.`;
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
          { role: 'system', content: SYSTEM_PROMPT },
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
      legalClauses: Array.isArray(result.legalClauses) ? result.legalClauses : [],
      operationalAgreements: Array.isArray(result.operationalAgreements) ? result.operationalAgreements : []
    };

    console.log(`Extracted: ${normalizedResult.extractedPeople.length} people, ${normalizedResult.legalClauses.length} clauses, ${normalizedResult.operationalAgreements.length} agreements`);

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
