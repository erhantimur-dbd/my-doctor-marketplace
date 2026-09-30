/**
 * In-memory rules for founding spots. Postgres functions in
 * supabase/migrations/00118_founding_claim_on_payment.sql apply the same
 * rules under a row lock. Checkout reserves. Payment claims. Expiry
 * releases the reservation. Featured follows the subscription's own dates.
 */

export interface FoundingDoctorState {
  isFoundingMember: boolean;
  foundingNumber: number | null;
  isFeatured: boolean;
  featuredUntil: string | null;
  forfeitedAt: string | null;
}

export interface FoundingReservation {
  doctorId: string;
  sessionId: string | null;
  status: "pending" | "converted" | "released";
}

export interface FoundingProgrammeState {
  maxSpots: number;
  isOpen: boolean;
  doctors: Record<string, FoundingDoctorState>;
  reservations: FoundingReservation[];
}

export function emptyFoundingProgramme(
  maxSpots = 100
): FoundingProgrammeState {
  return { maxSpots, isOpen: true, doctors: {}, reservations: [] };
}

function blankDoctor(): FoundingDoctorState {
  return {
    isFoundingMember: false,
    foundingNumber: null,
    isFeatured: false,
    featuredUntil: null,
    forfeitedAt: null,
  };
}

function doctorOf(
  state: FoundingProgrammeState,
  doctorId: string
): FoundingDoctorState {
  return state.doctors[doctorId] ?? blankDoctor();
}

export function claimedSpotCount(state: FoundingProgrammeState): number {
  return Object.values(state.doctors).filter((doctor) => doctor.isFoundingMember)
    .length;
}

function otherPending(
  state: FoundingProgrammeState,
  doctorId: string
): number {
  return state.reservations.filter(
    (row) => row.status === "pending" && row.doctorId !== doctorId
  ).length;
}

/**
 * Creating Checkout holds a spot. It does not mark the doctor a founding
 * member and does not set featured.
 */
export function openFoundingCheckout(
  state: FoundingProgrammeState,
  doctorId: string,
  sessionId: string
): { state: FoundingProgrammeState; reserved: boolean } {
  const doctor = doctorOf(state, doctorId);
  if (doctor.forfeitedAt) return { state, reserved: false };
  if (doctor.isFoundingMember) return { state, reserved: true };

  const pending = state.reservations.find(
    (row) => row.doctorId === doctorId && row.status === "pending"
  );
  if (pending) {
    return {
      reserved: true,
      state: {
        ...state,
        reservations: state.reservations.map((row) =>
          row === pending ? { ...row, sessionId } : row
        ),
      },
    };
  }

  if (
    !state.isOpen ||
    claimedSpotCount(state) + otherPending(state, doctorId) >= state.maxSpots
  ) {
    return { state, reserved: false };
  }

  return {
    reserved: true,
    state: {
      ...state,
      doctors: {
        ...state.doctors,
        [doctorId]: doctor,
      },
      reservations: [
        ...state.reservations,
        { doctorId, sessionId, status: "pending" },
      ],
    },
  };
}

/**
 * Payment success claims one spot. A second call returns the same number
 * and does not increment the count. featuredUntil is the subscription date
 * passed in (null leaves an existing date alone).
 */
export function claimFoundingOnPayment(
  state: FoundingProgrammeState,
  doctorId: string,
  featuredUntil: string | null
): {
  state: FoundingProgrammeState;
  claimed: boolean;
  foundingNumber: number | null;
  newlyClaimed: boolean;
} {
  const doctor = doctorOf(state, doctorId);
  if (doctor.forfeitedAt) {
    return { state, claimed: false, foundingNumber: null, newlyClaimed: false };
  }

  const convert = (next: FoundingProgrammeState): FoundingProgrammeState => ({
    ...next,
    reservations: next.reservations.map((row) =>
      row.doctorId === doctorId && row.status === "pending"
        ? { ...row, status: "converted" }
        : row
    ),
  });

  if (doctor.isFoundingMember && doctor.foundingNumber != null) {
    const featuredUntilNext = featuredUntil ?? doctor.featuredUntil;
    return {
      claimed: true,
      foundingNumber: doctor.foundingNumber,
      newlyClaimed: false,
      state: convert({
        ...state,
        doctors: {
          ...state.doctors,
          [doctorId]: {
            ...doctor,
            isFeatured: true,
            featuredUntil: featuredUntilNext,
          },
        },
      }),
    };
  }

  const claimed = claimedSpotCount(state);
  const hasHold = state.reservations.some(
    (row) => row.doctorId === doctorId && row.status === "pending"
  );
  if (claimed >= state.maxSpots) {
    return { state, claimed: false, foundingNumber: null, newlyClaimed: false };
  }
  if (!hasHold && claimed + otherPending(state, doctorId) >= state.maxSpots) {
    return { state, claimed: false, foundingNumber: null, newlyClaimed: false };
  }

  const foundingNumber = claimed + 1;
  const nextDoctor: FoundingDoctorState = {
    ...doctor,
    isFoundingMember: true,
    foundingNumber,
    isFeatured: true,
    featuredUntil,
  };
  const next: FoundingProgrammeState = convert({
    ...state,
    isOpen: foundingNumber < state.maxSpots,
    doctors: { ...state.doctors, [doctorId]: nextDoctor },
  });
  return {
    state: next,
    claimed: true,
    foundingNumber,
    newlyClaimed: true,
  };
}

/** Expired or abandoned Checkout drops the hold and does not claim. */
export function releaseFoundingCheckout(
  state: FoundingProgrammeState,
  sessionId: string
): FoundingProgrammeState {
  return {
    ...state,
    reservations: state.reservations.map((row) =>
      row.status === "pending" && row.sessionId === sessionId
        ? { ...row, status: "released" }
        : row
    ),
  };
}

/** Subscription end clears featured using the subscription's own timestamp. */
export function endFoundingFeatured(
  state: FoundingProgrammeState,
  doctorId: string,
  endedAt: string
): FoundingProgrammeState {
  const doctor = doctorOf(state, doctorId);
  return {
    ...state,
    doctors: {
      ...state.doctors,
      [doctorId]: {
        ...doctor,
        isFeatured: false,
        featuredUntil: endedAt,
      },
    },
  };
}
