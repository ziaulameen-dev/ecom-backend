import { Controller, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EventsService } from './events.service';

/**
 * GET /api/admin/events — Server-Sent Events stream of live order/return changes
 * for the admin panel. Admin-only. Since EventSource can't send an Authorization
 * header, the token is passed as `?access_token=` (the JWT guard reads it there).
 */
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse('admin/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  stream(): Observable<MessageEvent> {
    return this.events.stream();
  }
}
