import { Module } from '@nestjs/common';
import { ModelController } from './model.controller';
import { ModelService } from './model.service';
import { ModelGateway } from './model.gateway';

@Module({
    controllers: [ModelController],
    providers: [ModelService, ModelGateway],
})
export class ModelModule { }
