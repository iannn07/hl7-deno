// server.ts
import {
  Gender,
  HL7DBSchemaMapping,
  ImagingStudy,
  Patient,
  Study,
  ApiResponse,
  ErrorResponse
} from './types.ts'

// Supabase configuration
const SUPABASE_URL = "http://20.205.183.64:5050/rest/v1";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";

// CORRECTED TABLE NAMES
const TABLE_PATIENT = "ris_patient";
const TABLE_STUDY = "ris_study";
const TABLE_IMAGING_STUDY = "ris_imaging_study";

/**
 * A simple function to parse raw HL7 lines into an indexable structure.
 * We store each segment name (MSH, PID, OBR, etc.) in a map:
 *   parsed["PID"] = the array of its fields, e.g. parsed["PID"][3]
 */
function parseHL7Segments(hl7: string): Record<string, string[]>[] {
  const lines = hl7.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return lines.map((line) => {
    const fields = line.split('|')
    const segmentName = fields[0]
    return { [segmentName]: fields }
  })
}

/**
 * Extract the substring before `^` if it exists
 */
function firstCaretField(value = ''): string {
  return value.split('^')[0] || ''
}

/**
 * Minimal helper to interpret HL7-coded gender to our enum.
 * Add more rules if needed.
 */
function mapHL7GenderToEnum(g: string): Gender {
  switch (g.toLowerCase()) {
    case 'm':
    case 'male':
      return Gender.MALE
    case 'f':
    case 'female':
      return Gender.FEMALE
    default:
      return Gender.OTHER
  }
}

/**
 * Decide whether the exam is "cito" (i.e. urgent/STAT)
 * based on TQ1 or fallback to false if not present
 */
function parseCito(tq1Segment: string[]): boolean {
  // TQ1 example: TQ1|||||||20241217095948.021||R^Routine^HL70078
  // The cito flag might be gleaned from whether "STAT" or "S^Stat" is present
  const ninthField = tq1Segment[8] || ''
  // R^Routine^HL70078 => routine
  // S^Stat^HL70078 => stat
  if (
    ninthField.includes('Stat') ||
    ninthField.toLowerCase().includes('stat')
  ) {
    return true
  }
  return false
}

/**
 * Convert an HL7 date/time (e.g. 20241217095948.021)
 * to an ISO string (yyyy-mm-ddThh:mm:ss).
 * Naive implementation, just getting the basic format right.
 */
function hl7DateToISO(hl7Date = ''): string {
  if (!hl7Date || hl7Date.length < 8) {
    return '' // handle invalid or empty dates
  }

  // 20241217095948.021 => date part = 20241217, time part = 095948.021
  const dateString = hl7Date.substring(0, 8)
  const timeString = hl7Date.length > 8 ? hl7Date.substring(8).split('.')[0] : ''

  const year = dateString.substring(0, 4)
  const month = dateString.substring(4, 6)
  const day = dateString.substring(6, 8)

  let formattedTime = ''
  if (timeString) {
    // Pad to ensure we have at least 6 digits (hhmmss)
    const paddedTime = timeString.padStart(6, '0')
    const hours = paddedTime.substring(0, 2)
    const minutes = paddedTime.substring(2, 4)
    const seconds = paddedTime.substring(4, 6)
    formattedTime = `T${hours}:${minutes}:${seconds}`
  }

  return `${year}-${month}-${day}${formattedTime}`
}

/**
 * Map a parsed HL7 message to our DB schema types
 */
function mapHL7ToDBSchema(segments: Record<string, string[]>[]): HL7DBSchemaMapping {
  // Extract the segment arrays for easier access
  const msh = segments.find((s) => 'MSH' in s)?.MSH || []
  const pid = segments.find((s) => 'PID' in s)?.PID || []
  const obr = segments.find((s) => 'OBR' in s)?.OBR || []
  const tq1 = segments.find((s) => 'TQ1' in s)?.TQ1 || []

  // PID-3 often contains the MRN (patient identifier)
  const mrn = firstCaretField(pid[3])
  
  // Get a patient name from PID-5
  const patientName = pid[5] || ''
  const nameParts = patientName.split('^')
  const familyName = nameParts[0] || ''
  const givenName = nameParts[1] || ''
  
  // Gender from PID-8
  const gender = mapHL7GenderToEnum(pid[8] || '')
  
  // Birth date from PID-7
  const birthdate = hl7DateToISO(pid[7])
  
  // Get accession number from OBR-2 or OBR-3 (varies by system)
  const accessionNumber = firstCaretField(obr[2]) || firstCaretField(obr[3]) || ''
  
  // Get exam/procedure info from OBR-4
  const examination = obr[4] || ''
  
  // Set urgency/priority flag
  const cito = parseCito(tq1)
  
  // Determine a unique ID for our records - this might need refinement
  // based on your specific data needs (using accession# as basis)
  const studyId = `study-${accessionNumber}`
  const patientId = `patient-${mrn}`
  const imagingStudyId = `imaging-${accessionNumber}`
  
  // Create the required schema objects
  const patient: Patient = {
    id: patientId,
    mrn,
    givenName,
    familyName,
    gender,
    birthdate,
  }
  
  const study: Study = {
    id: studyId,
    accessionNumber,
    mrn,
    name: `${givenName} ${familyName}`,
    cito,
    examination,
    status: 'registered',
  }
  
  const imagingStudy: ImagingStudy = {
    id: imagingStudyId,
    started: new Date().toISOString(), // Current time as default
    status: 'registered',
    modality: 'US', // Default, could be refined based on your HL7 data
    numberOfSeries: 0, // Default, to be updated later
    numberOfInstances: 0, // Default, to be updated later
    studyID: studyId,
  }
  
  return {
    patient,
    study,
    imagingStudy,
  }
}

/**
 * Check if a patient exists in Supabase
 */
async function patientExists(patientId: string): Promise<boolean> {
  try {
    console.log(`Checking if patient ${patientId} exists...`);
    const response = await fetch(`${SUPABASE_URL}/${TABLE_PATIENT}?id=eq.${encodeURIComponent(patientId)}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (!response.ok) {
      console.error(`Error checking patient existence. Status: ${response.status}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      return false;
    }
    
    const data = await response.json() as Patient[];
    console.log(`Patient exists check result:`, data);
    return data && data.length > 0;
  } catch (error) {
    console.error("Error checking if patient exists:", error);
    return false;
  }
}

/**
 * Insert patient data into Supabase with enhanced error handling
 */
async function insertPatient(patient: Patient): Promise<{success: boolean, response: Response, data: Patient | ErrorResponse | string}> {
  console.log(`Inserting patient: ${JSON.stringify(patient)}`);
  try {
    // Validate required fields before sending
    if (!patient.id) {
      return {
        success: false,
        response: new Response(JSON.stringify({error: "Missing required field: id"} as ErrorResponse), {
          status: 400
        }),
        data: {error: "Missing required field: id"} as ErrorResponse
      };
    }
    
    const response = await fetch(`${SUPABASE_URL}/${TABLE_PATIENT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(patient)
    });
    
    let responseData: Patient | ErrorResponse | string;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json() as Patient | ErrorResponse;
    } else {
      responseData = await response.text();
    }
    
    return {
      success: response.ok,
      response,
      data: responseData
    };
  } catch (error) {
    console.error("Exception during patient insert:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      response: new Response(JSON.stringify({error: `Exception: ${errorMessage}`} as ErrorResponse), {
        status: 500
      }),
      data: {error: `Exception: ${errorMessage}`} as ErrorResponse
    };
  }
}

/**
 * Insert study data into Supabase with enhanced error handling
 */
async function insertStudy(study: Study): Promise<{success: boolean, response: Response, data: Study | ErrorResponse | string}> {
  console.log(`Inserting study: ${JSON.stringify(study)}`);
  try {
    // Validate required fields before sending
    if (!study.id || !study.mrn) {
      return {
        success: false,
        response: new Response(JSON.stringify({error: "Missing required fields: id or mrn"} as ErrorResponse), {
          status: 400
        }),
        data: {error: "Missing required fields: id or mrn"} as ErrorResponse
      };
    }
    
    const response = await fetch(`${SUPABASE_URL}/${TABLE_STUDY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(study)
    });
    
    let responseData: Study | ErrorResponse | string;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json() as Study | ErrorResponse;
    } else {
      responseData = await response.text();
    }
    
    return {
      success: response.ok,
      response,
      data: responseData
    };
  } catch (error) {
    console.error("Exception during study insert:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      response: new Response(JSON.stringify({error: `Exception: ${errorMessage}`} as ErrorResponse), {
        status: 500
      }),
      data: {error: `Exception: ${errorMessage}`} as ErrorResponse
    };
  }
}

/**
 * Insert imaging study data into Supabase with enhanced error handling
 */
async function insertImagingStudy(imagingStudy: ImagingStudy): Promise<{success: boolean, response: Response, data: ImagingStudy | ErrorResponse | string}> {
  console.log(`Inserting imaging study: ${JSON.stringify(imagingStudy)}`);
  try {
    // Validate required fields before sending
    if (!imagingStudy.id || !imagingStudy.studyID) {
      return {
        success: false,
        response: new Response(JSON.stringify({error: "Missing required fields: id or studyID"} as ErrorResponse), {
          status: 400
        }),
        data: {error: "Missing required fields: id or studyID"} as ErrorResponse
      };
    }
    
    const response = await fetch(`${SUPABASE_URL}/${TABLE_IMAGING_STUDY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(imagingStudy)
    });
    
    let responseData: ImagingStudy | ErrorResponse | string;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json() as ImagingStudy | ErrorResponse;
    } else {
      responseData = await response.text();
    }
    
    return {
      success: response.ok,
      response,
      data: responseData
    };
  } catch (error) {
    console.error("Exception during imaging study insert:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      response: new Response(JSON.stringify({error: `Exception: ${errorMessage}`} as ErrorResponse), {
        status: 500
      }),
      data: {error: `Exception: ${errorMessage}`} as ErrorResponse
    };
  }
}

// Main server handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === '/hl7' && req.method === 'POST') {
    try {
      // Parse the HL7 message from the request
      const body = await req.text();
      
      // Skip validation for now
      // Parse the HL7 message into segments
      const segments = parseHL7Segments(body);
      
      // Map the segments to our DB schema
      const dbObject = mapHL7ToDBSchema(segments);
      
      // Initialize result object for tracking operations
      const result: ApiResponse = {
        parsedData: dbObject,
        operations: {
          patientInserted: false,
          studyInserted: false,
          imagingStudyInserted: false
        },
        debug: {
          patient: "",
          study: "",
          imagingStudy: ""
        }
      };
      
      try {
        // Check if the patient already exists
        const patientAlreadyExists = await patientExists(dbObject.patient.id);
        
        // If the patient doesn't exist, create a new one
        if (!patientAlreadyExists) {
          const patientResult = await insertPatient(dbObject.patient);
          if (patientResult.success) {
            result.operations.patientInserted = true;
            console.log("Patient inserted successfully:", patientResult.data);
          } else {
            console.error("Failed to insert patient:", 
              patientResult.response.status, 
              patientResult.data);
          }
        } else {
          console.log("Patient already exists, skipping insert");
        }
        
        // Insert study data
        const studyResult = await insertStudy(dbObject.study);
        if (studyResult.success) {
          result.operations.studyInserted = true;
          console.log("Study inserted successfully:", studyResult.data);
        } else {
          console.error("Failed to insert study:", 
            studyResult.response.status, 
            studyResult.data);
        }
        
        // Insert imaging study data
        const imagingStudyResult = await insertImagingStudy(dbObject.imagingStudy);
        if (imagingStudyResult.success) {
          result.operations.imagingStudyInserted = true;
          console.log("Imaging study inserted successfully:", imagingStudyResult.data);
        } else {
          console.error("Failed to insert imaging study:", 
            imagingStudyResult.response.status, 
            imagingStudyResult.data);
        }
        
        // Set debug information
        result.debug = {
          patient: patientAlreadyExists ? "Existed already" : (result.operations.patientInserted ? "Inserted" : "Failed"),
          study: result.operations.studyInserted ? "Inserted" : "Failed",
          imagingStudy: result.operations.imagingStudyInserted ? "Inserted" : "Failed"
        };
        
        // Return JSON result including operations status and detailed information
        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: unknown) {
        const typedError = error as Error;
        console.error("Database operation error:", typedError);
        return new Response(JSON.stringify({ 
          error: 'Database operation failed',
          details: typedError.message || 'Unknown error',
          stack: typedError.stack
        } as ErrorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error: unknown) {
      const parseError = error as Error;
      console.error("HL7 parsing error:", parseError);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse HL7',
        details: parseError.message
      } as ErrorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // For other endpoints, just return a 404 or a simple message
  return new Response('Not Found', { status: 404 });
});
