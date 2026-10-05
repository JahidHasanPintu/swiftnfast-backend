import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { AdminAssistantController } from './admin-assistant.controller';
import { AssistantFaq, AssistantFaqSchema } from './schemas/faq.schema';
import { AssistantConfig, AssistantConfigSchema } from './schemas/config.schema';
import { AssistantUnanswered, AssistantUnansweredSchema } from './schemas/unanswered.schema';
import { AssistantEvent, AssistantEventSchema } from './schemas/event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssistantFaq.name, schema: AssistantFaqSchema },
      { name: AssistantConfig.name, schema: AssistantConfigSchema },
      { name: AssistantUnanswered.name, schema: AssistantUnansweredSchema },
      { name: AssistantEvent.name, schema: AssistantEventSchema },
    ]),
  ],
  controllers: [AssistantController, AdminAssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
