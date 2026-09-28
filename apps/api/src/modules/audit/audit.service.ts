import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor, AuditContext } from '../auth/auth.types';
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
@Injectable()
export class AuditService {
  async write(
    tx: Prisma.TransactionClient,
    actor: Actor,
    action: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
    context: AuditContext,
    entityType = 'WorkOrder',
  ) {
    return tx.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entityId,
        entityType,
        oldValue: oldValue === null ? Prisma.JsonNull : json(oldValue),
        newValue: newValue === null ? Prisma.JsonNull : json(newValue),
        ...context,
      },
    });
  }
}
