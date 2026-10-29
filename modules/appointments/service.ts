import type { TenantDb } from "@/lib/db/tenant";
import { assertOwned } from "@/lib/db/tenant";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES, isOneOf } from "@/lib/domain";
import { logActivity } from "@/modules/timeline/service";
import { emitTrigger } from "@/modules/workflows/engine";

export function listAppointments(db: TenantDb, range: { from: Date; to: Date }) {
  return db.appointment.findMany({
    where: { startAt: { gte: range.from, lt: range.to } },
    orderBy: { startAt: "asc" },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export function upcomingAppointments(db: TenantDb, now: Date, take = 5) {
  return db.appointment.findMany({
    where: { startAt: { gte: now }, status: "booked" },
    orderBy: { startAt: "asc" },
    take,
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export interface BookingInput {
  contactId: string;
  title: string;
  startAt: Date;
  endAt: Date;
}

export async function bookAppointment(db: TenantDb, input: BookingInput, opts: { now?: Date; describe?: (d: Date) => string } = {}) {
  if (!input.title.trim()) throw new Error("Title is required");
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) throw new Error("Invalid time");
  if (input.endAt <= input.startAt) throw new Error("End time must be after the start time");
  await assertOwned(db.contact, input.contactId, "Contact");
  const appointment = await db.appointment.create({
    data: {
      subAccountId: db.$subAccountId,
      contactId: input.contactId,
      title: input.title.trim(),
      startAt: input.startAt,
      endAt: input.endAt,
    },
  });
  const when = opts.describe ? opts.describe(input.startAt) : input.startAt.toISOString();
  await logActivity(db, input.contactId, "appointment_booked", `Appointment booked: ${appointment.title}`, when);
  await emitTrigger(db, { type: "appointment_booked", contactId: input.contactId, appointmentId: appointment.id }, { now: opts.now });
  return appointment;
}

export async function setAppointmentStatus(db: TenantDb, appointmentId: string, status: string, opts: { now?: Date } = {}) {
  if (!isOneOf(APPOINTMENT_STATUSES, status)) throw new Error("Invalid status");
  const appointment = await db.appointment.findFirst({ where: { id: appointmentId } });
  if (!appointment) throw new Error("Appointment not found");
  if (appointment.status === status) return;
  await db.appointment.update({ where: { id: appointment.id }, data: { status } });
  await logActivity(
    db,
    appointment.contactId,
    "appointment_status_changed",
    `Appointment "${appointment.title}" marked ${APPOINTMENT_STATUS_LABELS[status]}`,
  );
  await emitTrigger(
    db,
    { type: "appointment_status_changed", contactId: appointment.contactId, appointmentId: appointment.id, status },
    { now: opts.now },
  );
}
