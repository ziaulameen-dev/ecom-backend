import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

/** A live admin-panel event (order/return changed). */
export interface AdminEvent {
  type: 'order.created' | 'order.updated' | 'return.created' | 'return.updated';
  orderId?: string;
  returnId?: string;
  status?: string;
}

/**
 * In-process pub/sub for admin live updates, exposed over SSE. Single instance
 * (fine for one API replica); for multiple replicas back this with Redis pub/sub.
 */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<AdminEvent>();

  emit(event: AdminEvent): void {
    this.subject.next(event);
  }

  /** SSE stream of events as `MessageEvent`s (data serialized to JSON). */
  stream(): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(map((data) => ({ data })));
  }
}
