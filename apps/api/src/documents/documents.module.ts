import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MockSignatureProvider, SIGNATURE_PROVIDER } from './signature.provider';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: SIGNATURE_PROVIDER, useClass: MockSignatureProvider }],
})
export class DocumentsModule {}
