export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export type ImagingStudy = {
  id: string
  started: string
  status: string
  modality: string
  numberOfSeries: number
  numberOfInstances: number
  studyID: string
}

export type Study = {
  id: string
  accessionNumber: string
  mrn: string
  name: string
  cito: boolean
  examination: string
  status: string
  imageCount: number
  patientAge: string
}

export type Patient = {
  id: string
  givenName: string
  familyName: string
  gender: Gender
  birthDate: string
}

export type HL7DBSchemaMapping = {
  imagingStudy: ImagingStudy
  study: Study
  patient: Patient
}
