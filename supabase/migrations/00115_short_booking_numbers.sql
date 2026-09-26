-- New booking numbers are MD- plus 6 characters from an unambiguous alphabet
-- (no 0/O, 1/I/L). Existing BK-YYYYMMDD-XXXX values are not rewritten.
--
-- trg_generate_booking_number is already BEFORE INSERT. Replacing this
-- function keeps that attachment; the trigger is recreated below so the
-- timing stays explicit.
--
-- Set booking_number only when NEW.booking_number IS NULL. The clinic
-- reschedule successor insert passes `${booking_number}-R`. No insert
-- relies on the trigger overwriting a supplied value: every other insert
-- omits the column, so it arrives as NULL and is allocated here.
-- GP reassignment updates the existing row and does not mint a number.
--
-- pgcrypto: 00075 already calls gen_random_bytes (Supabase installs
-- pgcrypto in the extensions schema; this migration enables it if missing).
-- If that function is unavailable, bytes are taken from gen_random_uuid.
--
-- Retry up to 10 times when the candidate is already in bookings.
-- bookings_booking_number_key still rejects a concurrent race.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate TEXT;
  filled INT;
  buf BYTEA;
  buf_pos INT;
  b INT;
  hex TEXT;
  safety INT;
BEGIN
  IF NEW.booking_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR attempt IN 1..10 LOOP
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
      hex := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
      buf := decode(substr(hex, 1, 32), 'hex');
    END IF;

    candidate := 'MD-';
    filled := 0;
    buf_pos := 0;
    safety := 0;

    WHILE filled < 6 LOOP
      safety := safety + 1;
      IF safety > 64 THEN
        RAISE EXCEPTION
          'generate_booking_number: random source could not fill a booking number';
      END IF;

      IF buf_pos >= octet_length(buf) THEN
        hex := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');
        buf := decode(substr(hex, 1, 32), 'hex');
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
