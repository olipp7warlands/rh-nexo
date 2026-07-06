import { Injectable } from '@nestjs/common';

export interface SignatureResult {
  reference: string;
  signedAt: Date;
}

/** Interfaz de firma electrónica; en local se usa el mock. Sustituible por Signaturit/DocuSign. */
export interface SignatureProvider {
  sign(input: { documentId: string; employeeId: string }): Promise<SignatureResult>;
}

export const SIGNATURE_PROVIDER = 'SIGNATURE_PROVIDER';

@Injectable()
export class MockSignatureProvider implements SignatureProvider {
  async sign(input: { documentId: string; employeeId: string }): Promise<SignatureResult> {
    return { reference: `mock:${input.documentId}:${input.employeeId}`, signedAt: new Date() };
  }
}
