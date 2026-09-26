-- New booking numbers are MD- plus 6 characters from an unambiguous alphabet
-- (no 0/O, 1/I/L). Existing BK-YYYYMMDD-XXXX values are not rewritten.
--
-- trg_generate_booking_number is already BEFORE INSERT. Replacing this
-- function keeps that attachment; the trigger is recreated below so the
-- timing stays explicit.
--
-- Set booking_number only when NEW.booking_number IS NULL. The clinic
-- reschedule successor insert passes an explicit -R, -R2, ... value.
-- No insert relies on the trigger overwriting a supplied value: every
-- other insert omits the column, so it arrives as NULL and is allocated
-- here. GP reassignment updates the existing row and does not mint a number.
--
-- pgcrypto is required. gen_random_bytes is resolved from extensions
-- (Supabase) then public. There is no gen_random_uuid fallback: the
-- version and variant nibbles would bias the mapped characters.
--
-- search_path lists pg_catalog before public so a same-named object in
-- public cannot shadow hashtext, substr, or get_byte.
--
-- Before the existence check, take pg_advisory_xact_lock on
-- hashtext(candidate). Two concurrent inserts that draw the same
-- candidate cannot both pass NOT EXISTS: the second waits until the
-- first transaction ends, then regenerates when that row committed.
-- A hashtext collision between two different strings only serializes
-- them; the existence check is still on the string. The unique index
-- remains a backstop for an insert that does not take this lock.
--
-- Retry up to 10 times, then raise.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate TEXT;
  filled INT;
  buf BYTEA;
  buf_pos INT;
  b INT;
  safety INT;
BEGIN
  IF NEW.booking_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR attempt IN 1..10 LOOP
    candidate := 'MD-';
    filled := 0;
    buf := NULL;
    buf_pos := 0;
    safety := 0;

    WHILE filled < 6 LOOP
      safety := safety + 1;
      IF safety > 64 THEN
        RAISE EXCEPTION
          'generate_booking_number: random source could not fill a booking number';
      END IF;

      IF buf IS NULL OR buf_pos >= COALESCE(octet_length(buf), 0) THEN
        buf := NULL;
        BEGIN
          buf := extensions.gen_random_bytes(32);
        EXCEPTION
          WHEN undefined_function OR invalid_schema_name THEN
            buf := NULL;
        END;

        IF buf IS NULL THEN
          BEGIN
            buf := public.gen_random_bytes(32);
          EXCEPTION
            WHEN undefined_function THEN
              buf := NULL;
          END;
        END IF;

        IF buf IS NULL THEN
          RAISE EXCEPTION
            'generate_booking_number: pgcrypto gen_random_bytes is required';
        END IF;

        buf_pos := 0;
      END IF;

      b := get_byte(buf, buf_pos);
      buf_pos := buf_pos + 1;

      -- 31 * 8 = 248. Reject 248..255 so modulo mapping is unbiased.
      IF b < 248 THEN
        candidate := candidate || substr(alphabet, (b % 31) + 1, 1);
        filled := filled + 1;
      END IF;
    END LOOP;

    -- Held until this insert transaction ends, so the NOT EXISTS check
    -- and the following INSERT observe the same candidate exclusively.
    PERFORM pg_advisory_xact_lock(hashtext(candidate)::bigint);

    IF NOT EXISTS (
      SELECT 1
      FROM public.bookings
      WHERE booking_number = candidate
    ) THEN
      NEW.booking_number := candidate;
      RETURN NEW;
    END IF;

    IF attempt = 10 THEN
      RAISE EXCEPTION
        'generate_booking_number: could not allocate a unique booking number after % attempts',
        attempt;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.generate_booking_number() IS
  'BEFORE INSERT. Sets booking_number to MD- plus 6 unambiguous characters when it is NULL. Preserves explicit values such as reschedule -R suffixes. Does not modify existing rows.';

DROP TRIGGER IF EXISTS trg_generate_booking_number ON public.bookings;

CREATE TRIGGER trg_generate_booking_number
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_number();
