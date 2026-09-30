import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { buildPatientCalendarEvent } from "@/lib/booking/patient-calendar";

interface AddToCalendarProps {
  bookingId: string;
  doctorName: string;
  consultationType: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string | null;
  clinicName?: string | null;
  address?: string | null;
  bookingNumber?: string | null;
  downloadHref: string;
}

/**
 * Confirmation-page calendar actions. Kept separate from the time and
 * cancellation blocks so those can change without overlapping this UI.
 */
export function AddToCalendar({
  bookingId,
  doctorName,
  consultationType,
  appointmentDate,
  startTime,
  endTime,
  clinicName,
  address,
  bookingNumber,
  downloadHref,
}: AddToCalendarProps) {
  const calendar = buildPatientCalendarEvent({
    bookingId,
    doctorName,
    consultationType,
    appointmentDate,
    startTime,
    endTime,
    clinicName,
    address,
    bookingNumber,
    method: "REQUEST",
  });
  if (!calendar) return null;

  const links: Array<[string, string]> = [
    ["Google Calendar", calendar.links.google],
    ["Outlook.com", calendar.links.outlook],
    ["Office 365", calendar.links.office365],
    ["Yahoo Calendar", calendar.links.yahoo],
  ];

  return (
    <div className="w-full space-y-2">
      <p className="text-sm font-medium">Add to calendar</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map(([label, href]) => (
          <Button key={label} variant="outline" size="sm" className="w-full" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          </Button>
        ))}
      </div>
      <Button variant="outline" className="w-full" asChild>
        <a href={downloadHref}>
          <Download className="mr-2 h-4 w-4" />
          Download .ics
        </a>
      </Button>
    </div>
  );
}
