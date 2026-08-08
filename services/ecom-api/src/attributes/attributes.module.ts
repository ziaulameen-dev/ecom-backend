import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AttributeType } from './attribute-type.entity';
import { AttributeValue } from './attribute-value.entity';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

/** Admin-defined variant attributes (types + values). */
@Module({
  imports: [TypeOrmModule.forFeature([AttributeType, AttributeValue]), AuthModule],
  controllers: [AttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
