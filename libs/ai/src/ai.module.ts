import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';

/** Global so AiService is injectable everywhere without re-importing. */
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
