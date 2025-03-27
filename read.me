# HL7 Parser with Supabase Integration

## Overview
This application is a Deno-based HTTP server that processes HL7 messages, parses them, and stores the extracted data in a Supabase database. The server provides an endpoint for receiving HL7 messages, transforming them into structured data, and persisting the information in three related tables: `ris_patient`, `ris_study`, and `ris_imaging_study`.

## Features
- **HL7 Message Processing**: Receives and parses HL7 messages
- **Database Integration**: Stores extracted data in Supabase
- **Duplicate Detection**: Prevents duplicate patient records
- **Real-time Processing**: Handles incoming messages via HTTP endpoint
- **Structured Data Extraction**: Transforms HL7 into structured JSON

## Installation

# Clone the repository
git clone https://github.com/yourusername/hl7-parser.git
cd hl7-parser

# Install Deno if not already installed
# Windows (PowerShell)
iwr -useb https://deno.land/x/install/install.ps1 | iex

# Configure environment variables (create a .env file)
# Set your Supabase URL and API key

## Usage

### Running the Application

deno run --allow-net --allow-read --allow-write --watch server.ts

The server operates on http://localhost:8000/ by default and accepts HL7 messages via POST to the `/hl7` endpoint.

### Sending an HL7 Message

curl -X POST http://localhost:8000/hl7 \
  -H "Content-Type: text/plain" \
  -d "MSH|^~\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20240601123045||ADT^A01|MSG00001|P|2.3
PID|1||MRN12345^^^HOSPITAL^MR||DOE^JOHN^||19800101|M|||123 MAIN ST^^ANYTOWN^NY^10001||(555)555-5555||S||MRN12345||||12345678"

## Data Structure

The parser extracts data into the following database tables:

### 1. ris_patient
- Patient demographics and identifiers
- Unique identification by MRN

### 2. ris_study
- Study details including accession number
- Links to patient records via MRN

### 3. ris_imaging_study
- Imaging-specific information
- Links to study records via studyID

## Sample Output

The application logs operations to the console:

### Patient Processing
Checking if patient patient-123456 exists...
Patient exists check result: [
  {
    id: "patient-123456",
    givenName: "JOHN",
    familyName: "DOE",
    gender: "male",
    birthdate: "1980-01-01",
    created_at: "2025-03-27T08:37:16.868331+00:00",
    mrn: "123456"
  }
]
Patient already exists, skipping insert

### Study Processing
Inserting study: {"id":"study-ABC123","accessionNumber":"ABC123","mrn":"123456","name":"JOHN DOE","cito":false,"examination":"MRHEBRPP^MRI BRAIN per R^LOCAL","status":"registered"}
Study inserted successfully: [
  {
    id: "study-ABC123",
    accessionNumber: "ABC123",
    mrn: "123456",
    clinical: null,
    examination: "MRHEBRPP^MRI BRAIN per R^LOCAL",
    cito: false,
    status: "registered",
    bookmark: null,
    exam_images: null,
    exam_read: null,
    exam_register: null,
    patient_id: null,
    radiographer_id: null,
    operator_id: null,
    referring_doctor_id: null,
    pic_doctor_id: null,
    ward_id: null,
    dose_id: null,
    report_id: null,
    created_at: "2025-03-27T08:48:16.701408+00:00",
    name: "JOHN DOE"
  }
]

### Imaging Study Processing
Inserting imaging study: {"id":"imaging-ABC123","started":"2025-03-27T08:48:11.132Z","status":"registered","modality":"US","numberOfSeries":0,"numberOfInstances":0,"studyID":"study-ABC123"}
Imaging study inserted successfully: [
  {
    id: "imaging-ABC123",
    started: "2025-03-27T08:48:11.132",
    status: "registered",
    modality: "US",
    numberOfSeries: 0,
    numberOfInstances: 0,
    created_at: "2025-03-27T08:48:16.730826+00:00",
    studyID: "study-ABC123"
  }
]

## Resource Utilization

When running the server, the system resources consumed were measured using PowerShell:

Get-Process -Name deno | Format-Table Id, CPU, @{Name='Memory(MB)';Expression={[math]::Round($_.WorkingSet/1MB, 2)}}, Handles

### Results

| Process ID | CPU (seconds) | Memory (MB) | Handles |
|------------|---------------|-------------|---------|
| 6864       | 7.78125       | 155.76      | 227     |
| 18316      | 0.078125      | 58.79       | 204     |

### Resource Metrics Explanation

| Metric | Description |
|--------|-------------|
| Process ID | Unique identifier assigned by the operating system |
| CPU | Cumulative CPU time in seconds used by the process |
| Memory | Working set size in megabytes (RAM currently used) |
| Handles | Number of system resources (files, network connections, etc.) in use |

## Performance Analysis

- **Main Server Process (ID 6864)**:
  - Memory Usage: ~156 MB
  - CPU Time: ~7.8 seconds
  - Primary application process handling HTTP requests and database operations

- **Watcher Process (ID 18316)**:
  - Memory Usage: ~59 MB
  - CPU Time: minimal (0.08 seconds)
  - File watching service for development auto-reload

## Monitoring Commands

To monitor the application's resource usage in production:

# One-time snapshot
Get-Process -Name deno | Format-Table Id, CPU, @{Name='Memory(MB)';Expression={[math]::Round($_.WorkingSet/1MB, 2)}}, Handles

# Continuous monitoring (every 5 seconds)
while($true) {
  Get-Process -Name deno | Format-Table Id, @{Name='CPU(s)';Expression={[math]::Round($_.CPU, 2)}}, @{Name='Memory(MB)';Expression={[math]::Round($_.WorkingSet/1MB, 2)}}, Handles -AutoSize
  Write-Host ("Timestamp: {0}" -f (Get-Date -Format "HH:mm:ss"))
  Write-Host ("--------------------------------------")
  Start-Sleep -Seconds 5
}
