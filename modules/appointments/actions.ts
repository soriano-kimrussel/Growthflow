"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction, str } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/context";
import { formatDateTime, zonedWallTimeToUtc } from "@/lib/time";
import { bookAppointment, setAppointmentStatus } from "./service";

export async function bookAppointmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db, subAccount } = await requirePermission("appointments:write");
    const tz = subAccount.timezone;
    const startAt = zonedWallTimeToUtc(str(formData, "startAt"), tz);
    const minutes = Number(str(formData, "duration") || "30");
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) throw new Error("Invalid duration");
    await bookAppointment(
      db,
      {
        contactId: str(formData, "contactId"),
        title: str(formData, "title"),
        startAt,
        endAt: new Date(startAt.getTime() + minutes * 60_000),
      },
      { describe: (d) => formatDateTime(d, tz) },
    );
    revalidatePath("/", "layout");
    return "Appointment booked";
  });
}

export async function setAppointmentStatusAction(appointmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { db } = await requirePermission("appointments:write");
    await setAppointmentStatus(db, appointmentId, str(formData, "status"));
    revalidatePath("/", "layout");
  });
}
