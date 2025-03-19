import {
  Gender,
  HL7DBSchemaMapping,
  ImagingStudy,
  Patient,
  Study,
} from './types.ts'

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
 * Naive implementation; adapt to your date/time logic as needed.
 */
function parseHL7DateTime(hl7dt = ''): string {
  // E.g. "20241217095948.021"
  // year = 2024, month = 12, day=17, hour=09, minute=59, second=48...
  // We'll parse the basics:
  const year = hl7dt.slice(0, 4)
  const month = hl7dt.slice(4, 6)
  const day = hl7dt.slice(6, 8)
  const hour = hl7dt.slice(8, 10) || '00'
  const minute = hl7dt.slice(10, 12) || '00'
  const second = hl7dt.slice(12, 14) || '00'
  // We won't parse the fractional .021
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

/**
 * Given the fully-parsed HL7 segments, build up
 * the objects for your database schema.
 */
function mapHL7ToDBSchema(
  hl7Segments: Record<string, string[]>[]
): HL7DBSchemaMapping {
  // Handy lookups for a single segment by name
  const msh = hl7Segments.find((obj) => obj['MSH'])?.['MSH'] || []
  const pid = hl7Segments.find((obj) => obj['PID'])?.['PID'] || []
  const orc = hl7Segments.find((obj) => obj['ORC'])?.['ORC'] || []
  const obr = hl7Segments.find((obj) => obj['OBR'])?.['OBR'] || []
  const tq1 = hl7Segments.find((obj) => obj['TQ1'])?.['TQ1'] || []
  const obx = hl7Segments.find((obj) => obj['OBX'])?.['OBX'] || []

  // Extract needed fields from segments
  // For example, OBR.18 => Accession Number is typically OBR[18]
  const accessionNumber = obr[18] || ''
  const mrn = pid[3] || ''
  // OBX.5 => might hold the Study ID or DICOM Study UID
  const studyID = obx[5] || ''
  // OBR.4 => "MRHEBRPP^MRI BRAIN per R^LOCAL",
  // We might parse out the first ^ as code, second as name
  const obr4 = obr[4] || ''
  const examCode = firstCaretField(obr4) // "MRHEBRPP"
  const examName = obr4.split('^')[1] || '' // "MRI BRAIN per R"
  const orderStatus = orc[5] || ''

  // Patient name in PID.5 => "TESTIMPORT4^^^^^"
  const pid5 = pid[5] || ''
  const familyName = firstCaretField(pid5) // "TESTIMPORT4"
  // There's sometimes a second caret for given name, e.g. `Doe^John`
  const givenName = pid5.split('^')[1] || ''

  // Gender in PID.8 => "F"
  const rawGender = pid[8] || ''
  const gender: Gender = mapHL7GenderToEnum(rawGender)

  // Birth date in PID.7 => e.g. "19700101"
  const pid7 = pid[7] || ''
  const birthDate = pid7
    ? parseHL7DateTime(pid7.padEnd(14, '0')) // naive
    : '' // or fallback

  // TQ1 => if "STAT" => cito is true, else false
  const cito = parseCito(tq1)

  // ImagingStudy start time => often OBR.7 or TQ1.7. Use MSH.7 as fallback
  // For demonstration, we'll use MSH.7 => "20241217095948.021"
  const rawStarted = msh[6] || ''
  const started = parseHL7DateTime(rawStarted)

  // Build each part of your schema
  const imagingStudy: ImagingStudy = {
    id: crypto.randomUUID(),
    started,
    status: accessionNumber ? 'Available' : 'Unscheduled',
    modality: examCode || '',
    numberOfSeries: 0,
    numberOfInstances: 0,
    studyID,
  }

  const study: Study = {
    id: studyID,
    mrn: mrn,
    accessionNumber,
    name: examName,
    cito,
    examination: examCode,
    status: orderStatus,
  }

  const patient: Patient = {
    id: mrn,
    familyName,
    givenName,
    gender,
    birthDate,
  }

  return {
    imagingStudy,
    study,
    patient,
  }
}

/**
 * Create and start the server.
 */
Deno.serve({ port: 8080 }, async (req: Request) => {
  // Only handle POST /hl7
  const url = new URL(req.url)
  if (req.method === 'POST' && url.pathname === '/hl7') {
    try {
      // Read raw HL7 from request body
      const hl7Message = await req.text()

      // Parse HL7 into segments
      const segments = parseHL7Segments(hl7Message)

      // Map HL7 to DB schema
      const dbObject = mapHL7ToDBSchema(segments)

      // Check existing data in supabase

      // If the patient exists, stand still and go away bro

      // If the patient does not exist, create a new patient

      // Return JSON result
      return new Response(JSON.stringify(dbObject, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error(error)
      return new Response(JSON.stringify({ error: 'Failed to parse HL7' }), {
        status: 400,
      })
    }
  }
  // For other endpoints, just return a 404 or a simple message
  return new Response('Not Found', { status: 404 })
})
