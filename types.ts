// types.ts
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export interface ImagingStudy {
  id: string;
  started: string;
  status: string;
  modality: string;
  numberOfSeries: number;
  numberOfInstances: number;
  studyID: string;
}

export interface Study {
  id: string;
  accessionNumber: string;
  mrn: string;
  name: string;
  cito: boolean;
  examination: string;
  status: string;
}

export interface Patient {
  id: string;
  givenName: string;
  familyName: string;
  gender: Gender;
  birthdate: string;
  mrn: string;
}

export interface HL7DBSchemaMapping {
  imagingStudy: ImagingStudy;
  study: Study;
  patient: Patient;
}

// Response interfaces
export interface ApiResponse {
  parsedData: HL7DBSchemaMapping;
  operations: {
    patientInserted: boolean;
    studyInserted: boolean;
    imagingStudyInserted: boolean;
  };
  debug: {
    patient: string;
    study: string;
    imagingStudy: string;
  };
}

export interface ErrorResponse {
  error: string;
  details?: string;
  stack?: string;
}
