import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET - List bookings for an event
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const bookings = await prisma.booking.findMany({
      where: { eventId },
      include: {
        guest: true,
        roomBlock: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      eventId,
      roomBlockId,
      guestName,
      guestEmail,
      guestPhone,
      guestGroup,
      proximityRequest,
      selectedAddOns,
      specialRequests,
    } = await request.json();

    // Validate guestName is non-empty
    if (typeof guestName !== "string" || !guestName.trim()) {
      return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    }

    if (typeof eventId !== "string" || typeof roomBlockId !== "string") {
      return NextResponse.json({ error: "Event and room type are required" }, { status: 400 });
    }

    // Validate eventId exists and event is active/published
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || !["active", "published"].includes(event.status)) {
      return NextResponse.json({ error: "Event not available for booking" }, { status: 400 });
    }

    if (guestEmail != null && typeof guestEmail !== "string") {
      return NextResponse.json({ error: "Email must be a string" }, { status: 400 });
    }
    const normalizedEmail = typeof guestEmail === "string" ? guestEmail.trim().toLowerCase() : "";

    // Pre-validate room block exists
    const roomBlock = await prisma.roomBlock.findUnique({ where: { id: roomBlockId } });
    if (!roomBlock || roomBlock.eventId !== eventId) {
      return NextResponse.json({ error: "Room type not found for this event." }, { status: 400 });
    }

    // Server-side price calculation: compute total from room rate + add-ons
    const nights = Math.ceil(
      (new Date(event.checkOut).getTime() - new Date(event.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );
    const computedRoomTotal = roomBlock.rate * nights;

    // Calculate add-on total server-side
    let computedAddOnTotal = 0;
    if (selectedAddOns && selectedAddOns.length > 0) {
      const validAddOns = await prisma.addOn.findMany({
        where: { id: { in: selectedAddOns }, eventId },
      });
      if (validAddOns.length !== selectedAddOns.length) {
        return NextResponse.json(
          { error: "One or more selected add-ons do not belong to this event" },
          { status: 400 }
        );
      }
      computedAddOnTotal = validAddOns.reduce((sum, a) => sum + (a.isIncluded ? 0 : a.price), 0);
    }

    const serverComputedTotal = computedRoomTotal + computedAddOnTotal;

    // Wrap booking creation in a transaction — availability check INSIDE to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Serialise same-event/same-email requests made through this endpoint.
      // This is not a substitute for a database uniqueness constraint or for
      // hardening other legacy mutation endpoints.
      if (normalizedEmail) {
        const lockKey = `booking:${eventId}:${normalizedEmail}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked`;
        const duplicate = await tx.guest.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" }, eventId, status: "confirmed", bookings: { some: {} } },
          select: { id: true },
        });
        if (duplicate) throw new Error("DUPLICATE_EMAIL");
      }
      // Atomically reserve one available room. A conditional update locks the
      // row and rechecks its capacity after any concurrent update commits.
      const reserved = await tx.roomBlock.updateMany({
        where: { id: roomBlockId, eventId, bookedQty: { lt: tx.roomBlock.fields.totalQty } },
        data: { bookedQty: { increment: 1 } },
      });
      if (reserved.count !== 1) throw new Error("SOLD_OUT");
      const freshRoomBlock = await tx.roomBlock.findUniqueOrThrow({ where: { id: roomBlockId } });

      // The room counter already includes the reservation in this transaction.
      const currentBookedCount = freshRoomBlock.bookedQty;
      const discountRules = await tx.discountRule.findMany({
        where: { eventId, isActive: true },
        orderBy: { minRooms: "desc" },
      });
      const applicableRule = discountRules.find((r: { minRooms: number }) => currentBookedCount >= r.minRooms);
      const discountPct = applicableRule ? applicableRule.discountPct : 0;
      const finalAmount = discountPct > 0
        ? Math.round(serverComputedTotal * (1 - discountPct / 100))
        : serverComputedTotal;

      // Create guest (save specialRequests to notes)
      const guest = await tx.guest.create({
        data: {
          name: guestName,
          email: normalizedEmail || null,
          phone: guestPhone || null,
          group: guestGroup || null,
          proximityRequest: proximityRequest || null,
          notes: specialRequests || null,
          status: "confirmed",
          eventId,
        },
      });

      // Create booking (with discount applied)
      const booking = await tx.booking.create({
        data: {
          guestId: guest.id,
          eventId,
          roomBlockId,
          totalAmount: finalAmount,
          status: "confirmed",
        },
      });

      // Create booking add-ons
      if (selectedAddOns && selectedAddOns.length > 0) {
        for (const addOnId of selectedAddOns) {
          const addOn = await tx.addOn.findUnique({ where: { id: addOnId } });
          if (addOn) {
            await tx.bookingAddOn.create({
              data: {
                bookingId: booking.id,
                addOnId,
                price: addOn.isIncluded ? 0 : addOn.price,
              },
            });
          }
        }
      }

      // Keep the audit entry in the transaction: a failed log must not report
      // a failure to the guest after silently committing their booking.
      await tx.activityLog.create({
        data: {
          eventId,
          action: "booking_created",
          details: `${guestName} booked ${booking.id.slice(0, 8)} — ₹${booking.totalAmount.toLocaleString("en-IN")}`,
          actor: guestName,
        },
      });
      return { guest, booking };
    });

    return NextResponse.json({
      success: true,
      booking: { id: result.booking.id },
      bookingId: result.booking.id,
      guestId: result.guest.id,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "A booking with this email already exists for this event." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SOLD_OUT") {
      return NextResponse.json(
        { error: "This room type is no longer available." },
        { status: 400 }
      );
    }
    console.error("Booking error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
